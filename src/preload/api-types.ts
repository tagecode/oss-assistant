import type {
  AccountInput,
  AccountPublic,
  AppSettings,
  BucketInfo,
  DiagnosticInfo,
  ListObjectsResult,
  TransferTask
} from '../shared/types/storage'

export interface OssApi {
  getVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  listAccounts: () => Promise<AccountPublic[]>
  createAccount: (input: AccountInput) => Promise<AccountPublic>
  updateAccount: (id: string, input: Partial<AccountInput>) => Promise<AccountPublic>
  deleteAccount: (id: string) => Promise<void>
  testConnection: (input: Partial<AccountInput>, accountId?: string) => Promise<void>
  listBuckets: (accountId: string) => Promise<BucketInfo[]>
  listObjects: (
    accountId: string,
    bucket: string,
    prefix?: string,
    marker?: string
  ) => Promise<ListObjectsResult>
  listTransfers: () => Promise<TransferTask[]>
  createUpload: (params: {
    accountId: string
    bucket: string
    prefix: string
    localPaths: string[]
  }) => Promise<TransferTask[]>
  createDownload: (params: {
    accountId: string
    bucket: string
    items: { key: string; localPath: string }[]
  }) => Promise<TransferTask[]>
  pathsExist: (paths: string[]) => Promise<boolean[]>
  resolveDownloadPaths: (
    localDir: string,
    keys: string[]
  ) => Promise<{ key: string; localPath: string }[]>
  uniqueDownloadPath: (localDir: string, fileName: string) => Promise<string>
  createDelete: (params: {
    accountId: string
    bucket: string
    keys: string[]
  }) => Promise<TransferTask[]>
  cancelTransfer: (taskId: string) => Promise<void>
  retryTransfer: (taskId: string) => Promise<void>
  clearCompletedTransfers: () => Promise<void>
  onTransferUpdate: (callback: (tasks: TransferTask[]) => void) => () => void
  getSettings: () => Promise<AppSettings>
  updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  selectDirectory: () => Promise<string | null>
  selectFiles: () => Promise<string[]>
  getDiagnosticInfo: () => Promise<DiagnosticInfo>
  exportDiagnostics: () => Promise<string>
  getPathForFile: (file: File) => string
}
