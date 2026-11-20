import type {
  AccountConfig,
  BucketInfo,
  ListObjectsResult,
  StorageProvider as StorageProviderType,
  TransferProgress
} from '../../shared/types/storage'

export interface ProviderCredentials {
  accessKeyId: string
  secretKey: string
  provider?: StorageProviderType
  region?: string
  endpoint?: string
  bucketDomain?: string
  pathStyleAccess?: boolean
}

/** 一个已成功上传的分片，重试时据此跳过重复传输。 */
export interface UploadedPart {
  partNumber: number
  etag: string
}

/**
 * 分片上传检查点。不同服务商记录的信息不同：
 * - S3 / 兼容 S3：`uploadId` + 已完成 `parts`
 * - 阿里云 OSS：`uploadId` + `parts`（用于重建 SDK checkpoint）
 * - 七牛：`resumeDir` + `resumeKey`（SDK 自带断点记录器）
 *
 * `fileSize` / `fileMtimeMs` 用于校验本地文件在重试之间是否被改动，避免用旧
 * 分片拼接出一个内容不完整的对象。
 */
export interface UploadCheckpoint {
  partSize: number
  uploadId?: string
  parts?: UploadedPart[]
  resumeDir?: string
  resumeKey?: string
  fileSize?: number
  fileMtimeMs?: number
}

export interface TransferOptions {
  onProgress?: (progress: TransferProgress) => void
  signal?: AbortSignal
}

export interface UploadOptions extends TransferOptions {
  /** 上一次尝试留下的检查点，存在时从已完成的分片继续。 */
  checkpoint?: UploadCheckpoint
  /** 每完成一个分片回调一次，供调用方保存检查点。 */
  onCheckpoint?: (checkpoint: UploadCheckpoint) => void
}

export interface StorageProvider {
  testConnection(credentials: ProviderCredentials): Promise<void>
  listBuckets(credentials: ProviderCredentials): Promise<BucketInfo[]>
  listObjects(
    credentials: ProviderCredentials,
    bucket: string,
    prefix?: string,
    marker?: string
  ): Promise<ListObjectsResult>
  uploadObject(
    credentials: ProviderCredentials,
    bucket: string,
    key: string,
    localPath: string,
    options?: UploadOptions
  ): Promise<void>
  downloadObject(
    credentials: ProviderCredentials,
    bucket: string,
    key: string,
    localPath: string,
    options?: TransferOptions
  ): Promise<void>
  deleteObjects(
    credentials: ProviderCredentials,
    bucket: string,
    keys: string[]
  ): Promise<{ succeeded: string[]; failed: { key: string; error: string }[] }>
}

export function accountToCredentials(
  account: AccountConfig,
  accessKeyId: string,
  secretKey: string
): ProviderCredentials {
  return {
    accessKeyId,
    secretKey,
    provider: account.provider,
    region: account.region,
    endpoint: account.endpoint,
    bucketDomain: account.bucketDomain,
    pathStyleAccess: account.pathStyleAccess
  }
}

export function calcProgress(
  transferred: number,
  total: number,
  startTime: number
): TransferProgress {
  const elapsed = (Date.now() - startTime) / 1000
  const speed = elapsed > 0 ? transferred / elapsed : 0
  const remaining = speed > 0 ? (total - transferred) / speed : 0
  return {
    transferredBytes: transferred,
    totalBytes: total,
    speedBytesPerSecond: speed,
    estimatedRemainingSeconds: remaining,
    progressPercent: total > 0 ? Math.round((transferred / total) * 100) : 0
  }
}
