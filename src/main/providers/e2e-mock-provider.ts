import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'fs'
import type { Stats } from 'fs'
import { dirname } from 'path'
import type { BucketInfo, ListObjectsResult, StorageObject } from '../../shared/types/storage'
import {
  type ProviderCredentials,
  type StorageProvider,
  type TransferOptions,
  type UploadedPart,
  type UploadOptions,
  calcProgress
} from './base-provider'
import {
  abortableDelay,
  bytesBeforePart,
  countParts,
  isCheckpointStale,
  MULTIPART_PART_SIZE_BYTES,
  MULTIPART_THRESHOLD_BYTES,
  resolvePartSize
} from './multipart'

const MOCK_BUCKET = 'e2e-mock-bucket'

/** 文件 key 含该标记时，Mock 会在第 1 个分片后注入一次可重试的网络错误。 */
const RETRYABLE_FAILURE_MARKER = 'e2e-retryable'
const DEFAULT_STEP_DELAY_MS = 50
const DEFAULT_PART_DELAY_MS = 120

function readDelayEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

/** key 含该标记时，第 1 个分片后抛一个不可重试的错误，等待用户手动重试。 */
const MANUAL_RETRY_FAILURE_MARKER = 'e2e-manual-retry'

function shouldInjectTransientFailure(key: string): boolean {
  return key.includes(RETRYABLE_FAILURE_MARKER)
}

function shouldRequireManualRetry(key: string): boolean {
  return key.includes(MANUAL_RETRY_FAILURE_MARKER)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type StoredObject = {
  size: number
  lastModified: string
  storageClass: string
  etag: string
  localCopyPath?: string
}

const objectStore = new Map<string, Map<string, StoredObject>>()

/** 已注入过瞬时错误的对象 key，保证同一应用实例内每个 key 只失败一次。 */
const transientFailureConsumed = new Set<string>()

/** 已抛过不可重试错误的 key；再次上传（用户手动重试）时必须带检查点。 */
const manualRetryConsumed = new Set<string>()

function bucketStore(bucket: string): Map<string, StoredObject> {
  let store = objectStore.get(bucket)
  if (!store) {
    store = new Map()
    objectStore.set(bucket, store)
  }
  return store
}

export class E2eMockProvider implements StorageProvider {
  async testConnection(_credentials: ProviderCredentials): Promise<void> {
    return
  }

  async listBuckets(_credentials: ProviderCredentials): Promise<BucketInfo[]> {
    return [
      {
        name: MOCK_BUCKET,
        region: 'mock-region',
        createdAt: '2026-01-01T00:00:00.000Z',
        permission: 'private'
      }
    ]
  }

  async listObjects(
    _credentials: ProviderCredentials,
    bucket: string,
    prefix = '',
    _marker?: string
  ): Promise<ListObjectsResult> {
    const store = bucketStore(bucket)
    const dirSet = new Set<string>()
    const fileObjects: StorageObject[] = []

    for (const [key, meta] of store.entries()) {
      if (!key.startsWith(prefix)) continue
      const relative = key.slice(prefix.length)
      const slashIdx = relative.indexOf('/')
      if (slashIdx >= 0) {
        dirSet.add(`${prefix}${relative.slice(0, slashIdx + 1)}`)
        continue
      }
      fileObjects.push({
        key,
        name: relative,
        prefix,
        size: meta.size,
        lastModified: meta.lastModified,
        etag: meta.etag,
        storageClass: meta.storageClass,
        isDirectory: false
      })
    }

    const dirObjects: StorageObject[] = [...dirSet].map((p) => ({
      key: p,
      name: p.replace(prefix, '').replace(/\/$/, ''),
      prefix,
      size: 0,
      isDirectory: true
    }))

    return {
      objects: [...dirObjects, ...fileObjects],
      prefix,
      hasMore: false
    }
  }

  async uploadObject(
    _credentials: ProviderCredentials,
    bucket: string,
    key: string,
    localPath: string,
    options: UploadOptions = {}
  ): Promise<void> {
    const signal = options.signal
    if (signal?.aborted) throw new Error('上传已取消')
    const fileStat = statSync(localPath)
    const total = fileStat.size

    if (total > MULTIPART_THRESHOLD_BYTES) {
      await this.uploadMultipart(key, fileStat, total, options)
    } else {
      await this.uploadSingleFile(total, options)
    }

    const store = bucketStore(bucket)
    store.set(key, {
      size: total,
      lastModified: new Date().toISOString(),
      storageClass: 'STANDARD',
      etag: `"mock-${Date.now()}"`,
      localCopyPath: localPath
    })
  }

  /** 小文件仍走单请求，保持既有用例的 5 段进度节奏。 */
  private async uploadSingleFile(total: number, options: UploadOptions): Promise<void> {
    const signal = options.signal
    const steps = 5
    const stepDelay = readDelayEnv('E2E_MOCK_STEP_DELAY_MS', DEFAULT_STEP_DELAY_MS)

    for (let i = 1; i <= steps; i++) {
      if (i > 1) await abortableDelay(stepDelay, signal)
      const transferred = Math.round((i / steps) * total)
      // 保持原有节奏：第 i 段报告的速度相当于已经跑了 i 个 stepDelay。
      const startTime = Date.now() - i * stepDelay
      options.onProgress?.(calcProgress(transferred, total, startTime))
    }
  }

  /**
   * 按真实 provider 的语义模拟分片上传：逐片回调检查点与进度，重试时跳过
   * 检查点里已完成的分片，取消则在当前分片的等待期间立即中止。
   *
   * key 含 e2e-retryable 时会在第 1 片后抛出一次 retryable 错误；第二次尝试
   * 如果拿不到带分片的检查点就直接失败，用来验证 TransferService 真的把
   * checkpoint 透传到了 provider，而不是每次重试都从头传。
   */
  private async uploadMultipart(
    key: string,
    fileStat: Stats,
    total: number,
    options: UploadOptions
  ): Promise<void> {
    const signal = options.signal
    const partSize = resolvePartSize(total, MULTIPART_PART_SIZE_BYTES)
    const partCount = countParts(total, partSize)
    const resumable =
      options.checkpoint && !isCheckpointStale(options.checkpoint, fileStat)
        ? options.checkpoint
        : undefined
    const uploaded = new Map<number, string>()
    for (const part of resumable?.parts ?? []) {
      uploaded.set(part.partNumber, part.etag)
    }
    const uploadId = resumable?.uploadId ?? `mock-upload-${Date.now()}`
    const partDelay = readDelayEnv('E2E_MOCK_PART_DELAY_MS', DEFAULT_PART_DELAY_MS)
    const startTime = Date.now()

    if (
      shouldInjectTransientFailure(key) &&
      transientFailureConsumed.has(key) &&
      uploaded.size === 0
    ) {
      throw new Error('mock: 重试时没有收到断点检查点，无法续传')
    }
    if (shouldRequireManualRetry(key) && manualRetryConsumed.has(key) && uploaded.size === 0) {
      throw new Error('mock: 手动重试时没有收到断点检查点，无法续传')
    }

    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      if (!uploaded.has(partNumber)) {
        await abortableDelay(partDelay, signal)
        uploaded.set(partNumber, `"mock-part-${partNumber}"`)
        const parts: UploadedPart[] = [...uploaded.entries()]
          .map(([number, etag]) => ({ partNumber: number, etag }))
          .sort((a, b) => a.partNumber - b.partNumber)
        options.onCheckpoint?.({
          uploadId,
          partSize,
          parts,
          fileSize: fileStat.size,
          fileMtimeMs: fileStat.mtimeMs
        })
      }

      const transferred = bytesBeforePart(total, partSize, partNumber) + partSize
      options.onProgress?.(calcProgress(Math.min(transferred, total), total, startTime))

      if (shouldRequireManualRetry(key) && !manualRetryConsumed.has(key) && partNumber === 1) {
        manualRetryConsumed.add(key)
        throw Object.assign(new Error('mock: 首次上传失败，等待手动重试'), { retryable: false })
      }

      if (
        shouldInjectTransientFailure(key) &&
        !transientFailureConsumed.has(key) &&
        partNumber === 1
      ) {
        transientFailureConsumed.add(key)
        throw Object.assign(new Error('mock: 模拟网络抖动'), { retryable: true })
      }
    }
  }

  async downloadObject(
    _credentials: ProviderCredentials,
    bucket: string,
    key: string,
    localPath: string,
    options: TransferOptions = {}
  ): Promise<void> {
    const signal = options.signal
    if (signal?.aborted) throw new Error('下载已取消')
    const store = bucketStore(bucket)
    const obj = store.get(key)
    if (!obj) throw new Error('对象不存在')

    const dir = dirname(localPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const total = obj.size
    const steps = 5
    const stepDelay = Math.max(50, 200 / steps)

    for (let i = 1; i <= steps; i++) {
      if (signal?.aborted) throw new Error('下载已取消')
      const transferred = Math.round((i / steps) * total)
      const startTime = Date.now() - (i / steps) * (stepDelay * steps)
      options.onProgress?.(calcProgress(transferred, total, startTime))
      if (i < steps) await sleep(stepDelay)
    }

    if (obj.localCopyPath && existsSync(obj.localCopyPath)) {
      copyFileSync(obj.localCopyPath, localPath)
    } else {
      writeFileSync(localPath, `mock content for ${key}`)
    }

    const startTime = Date.now() - 200
    options.onProgress?.(calcProgress(total, total, startTime))
  }

  async deleteObjects(
    _credentials: ProviderCredentials,
    bucket: string,
    keys: string[]
  ): Promise<{ succeeded: string[]; failed: { key: string; error: string }[] }> {
    const store = bucketStore(bucket)
    const succeeded: string[] = []
    const failed: { key: string; error: string }[] = []

    for (const key of keys) {
      if (store.delete(key)) {
        succeeded.push(key)
      } else {
        failed.push({ key, error: '对象不存在' })
      }
    }

    return { succeeded, failed }
  }
}

export function isE2eMockMode(): boolean {
  return process.env.E2E_MOCK_CLOUD === '1' || process.argv.includes('--e2e-mock-cloud')
}

export function getE2eMockBucketName(): string {
  return MOCK_BUCKET
}
