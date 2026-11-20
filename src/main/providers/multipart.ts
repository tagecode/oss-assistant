import type { Stats } from 'fs'
import type { UploadCheckpoint } from './base-provider'

/** 超过该大小的文件才值得走分片上传；小文件单请求更快。 */
export const MULTIPART_THRESHOLD_BYTES = 8 * 1024 * 1024

/** S3 兼容服务的最小分片为 5MB，统一用 8MB 留出余量。 */
export const MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024

/** 七牛分片上传 v2 的推荐分片大小。 */
export const QINIU_PART_SIZE_BYTES = 4 * 1024 * 1024

/** 自动重试上限：PRD §8.1 要求限流时指数退避，最多重试 3 次。 */
export const MAX_UPLOAD_RETRIES = 3

/** 首次重试延迟，之后按 1s / 2s / 4s 指数退避。 */
export const RETRY_BASE_DELAY_MS = 1000

/** 三家服务商的分片数量上限都是 10000，超过会被拒绝。 */
export const MAX_MULTIPART_PARTS = 10_000

/**
 * 按文件大小放大分片，保证分片数不超过服务商上限。
 *
 * 固定 8MB 分片最多只能覆盖约 78GB；超过后必须用更大的分片，否则会触发
 * “分片数量超过 10000”的服务端错误，而不是正常上传。
 */
export function resolvePartSize(totalBytes: number, minPartSize: number): number {
  const needed = Math.ceil(totalBytes / MAX_MULTIPART_PARTS)
  const megabyte = 1024 * 1024
  return Math.max(minPartSize, Math.ceil(needed / megabyte) * megabyte)
}

/**
 * 判断错误是否值得自动重试。
 *
 * 只有 provider 层显式标记 `retryable`（网络错误、限流、5xx 等）才重试；
 * 认证、权限、文件不存在等问题重试也不会成功。
 */
export function isRetryableUploadError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { retryable?: unknown }).retryable === true
  )
}

export function throwIfAborted(signal: AbortSignal | undefined, message = '任务已取消'): void {
  if (signal?.aborted) {
    throw new Error(message)
  }
}

/** 可被 AbortSignal 打断的等待，用于重试退避期间响应取消。 */
export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('任务已取消'))
      return
    }

    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Error('任务已取消'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * 让底层请求与 AbortSignal 赛跑。
 *
 * SDK 不支持取消时（七牛 / 阿里云），先由调用方销毁数据流或调用 SDK 的
 * cancel，再用本函数保证 UI 立即收到取消结果，而不是等当前请求自然结束。
 */
export function rejectOnAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
  message = '任务已取消'
): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) {
    promise.catch(() => undefined)
    return Promise.reject(new Error(message))
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(new Error(message))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

export function countParts(totalBytes: number, partSize: number): number {
  return totalBytes > 0 ? Math.ceil(totalBytes / partSize) : 0
}

export function partByteRange(
  totalBytes: number,
  partSize: number,
  partNumber: number
): { start: number; end: number; size: number } {
  const start = (partNumber - 1) * partSize
  const end = Math.min(start + partSize, totalBytes)
  return { start, end, size: Math.max(0, end - start) }
}

/** 前 `partNumber - 1` 个分片累计的字节数，用于恢复进度显示。 */
export function bytesBeforePart(totalBytes: number, partSize: number, partNumber: number): number {
  return Math.min((partNumber - 1) * partSize, totalBytes)
}

/**
 * 检查点是否仍然适用于当前文件。
 *
 * 重试之间本地文件如果被替换或改动，继续用旧分片会拼出损坏对象，此时必须
 * 丢弃检查点从头上传。
 */
export function isCheckpointStale(checkpoint: UploadCheckpoint, stat: Stats): boolean {
  if (checkpoint.fileSize !== undefined && checkpoint.fileSize !== stat.size) {
    return true
  }
  if (checkpoint.fileMtimeMs !== undefined && Math.abs(checkpoint.fileMtimeMs - stat.mtimeMs) > 1) {
    return true
  }
  return false
}
