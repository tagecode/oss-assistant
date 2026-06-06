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
    onProgress?: (progress: TransferProgress) => void,
    signal?: AbortSignal
  ): Promise<void>
  downloadObject(
    credentials: ProviderCredentials,
    bucket: string,
    key: string,
    localPath: string,
    onProgress?: (progress: TransferProgress) => void,
    signal?: AbortSignal
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
