export type StorageProvider = 'qiniu' | 'aliyun-oss' | 'aws-s3' | 's3-compatible'

export type TransferType = 'upload' | 'download' | 'delete'
export type TransferStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled'

export type ThemeMode = 'system' | 'light' | 'dark'
export type LanguageSetting = 'system' | 'zh' | 'en'
export type Language = 'zh' | 'en'

export interface AccountConfig {
  id: string
  name: string
  provider: StorageProvider
  encryptedAccessKeyRef: string
  encryptedSecretRef: string
  region?: string
  endpoint?: string
  bucketDomain?: string
  pathStyleAccess?: boolean
  createdAt: string
  updatedAt: string
  lastConnectedAt?: string
  lastConnectionStatus?: 'connected' | 'failed' | 'unknown'
}

export interface AccountInput {
  name: string
  provider: StorageProvider
  accessKeyId?: string
  secretKey?: string
  region?: string
  endpoint?: string
  bucketDomain?: string
  pathStyleAccess?: boolean
}

export interface AccountPublic extends Omit<
  AccountConfig,
  'encryptedSecretRef' | 'encryptedAccessKeyRef'
> {
  hasAccessKey: boolean
  hasSecret: boolean
}

export interface BucketInfo {
  name: string
  region?: string
  createdAt?: string
  permission?: 'public' | 'private' | 'unknown'
}

export interface StorageObject {
  key: string
  name: string
  prefix: string
  size: number
  lastModified?: string
  etag?: string
  storageClass?: string
  contentType?: string
  isDirectory: boolean
}

export interface ListObjectsResult {
  objects: StorageObject[]
  prefix: string
  hasMore: boolean
  nextMarker?: string
}

export interface TransferProgress {
  transferredBytes: number
  totalBytes: number
  speedBytesPerSecond: number
  estimatedRemainingSeconds: number
  progressPercent: number
}

export interface TransferTask {
  id: string
  type: TransferType
  status: TransferStatus
  accountId: string
  bucket: string
  objectKey: string
  localPath?: string
  totalBytes?: number
  transferredBytes?: number
  progressPercent?: number
  speedBytesPerSecond?: number
  estimatedRemainingSeconds?: number
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface DownloadItem {
  key: string
  localPath: string
}

export interface AppSettings {
  theme: ThemeMode
  language: LanguageSetting
  defaultDownloadPath: string
  transferConcurrency: number
  logRetentionDays: number
  autoCheckUpdate: boolean
}

export interface DiagnosticInfo {
  appVersion: string
  electronVersion: string
  platform: string
  arch: string
  logs: string[]
}

export interface ProviderError {
  code: string
  message: string
  retryable: boolean
}
