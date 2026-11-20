import { randomUUID } from 'crypto'
import { basename } from 'path'
import { BrowserWindow } from 'electron'
import type { TransferProgress, TransferTask, TransferType } from '../../shared/types/storage'
import { AccountService } from './account-service'
import { SettingsService } from './settings-service'
import { QiniuProvider } from '../providers/qiniu-provider'
import { AliyunOssProvider } from '../providers/aliyun-oss-provider'
import { S3Provider } from '../providers/s3-provider'
import {
  accountToCredentials,
  type ProviderCredentials,
  type StorageProvider,
  type UploadCheckpoint
} from '../providers/base-provider'
import {
  MAX_UPLOAD_RETRIES,
  RETRY_BASE_DELAY_MS,
  abortableDelay,
  isRetryableUploadError
} from '../providers/multipart'
import { redactSensitiveText } from './redaction-service'

interface CreateUploadParams {
  accountId: string
  bucket: string
  prefix: string
  localPaths: string[]
}

interface CreateDownloadParams {
  accountId: string
  bucket: string
  items: { key: string; localPath: string }[]
}

interface CreateDeleteParams {
  accountId: string
  bucket: string
  keys: string[]
}

export class TransferService {
  private tasks: TransferTask[] = []
  private running = 0
  private abortControllers = new Map<string, AbortController>()
  private uploadCheckpoints = new Map<string, UploadCheckpoint>()
  private accountService: AccountService
  private settingsService: SettingsService
  private providers: Record<string, StorageProvider>
  private retryBaseDelayMs: number

  constructor(
    accountService: AccountService,
    settingsService: SettingsService,
    providers?: Record<string, StorageProvider>,
    retryBaseDelayMs = RETRY_BASE_DELAY_MS
  ) {
    this.accountService = accountService
    this.settingsService = settingsService
    this.providers = providers ?? {
      qiniu: new QiniuProvider(),
      'aliyun-oss': new AliyunOssProvider(),
      'aws-s3': new S3Provider(),
      's3-compatible': new S3Provider()
    }
    this.retryBaseDelayMs = retryBaseDelayMs
  }

  list(): TransferTask[] {
    return [...this.tasks]
  }

  private getProvider(accountId: string): StorageProvider {
    const account = this.accountService.getById(accountId)
    if (!account) throw new Error('账户不存在')
    const provider = this.providers[account.provider]
    if (!provider) throw new Error(`不支持的服务商: ${account.provider}`)
    return provider
  }

  private emitUpdate(): void {
    const windows = BrowserWindow.getAllWindows()
    const tasks = this.list()
    windows.forEach((win) => {
      win.webContents.send('transfer:onUpdate', tasks)
    })
  }

  private createTask(
    type: TransferType,
    accountId: string,
    bucket: string,
    objectKey: string,
    localPath?: string
  ): TransferTask {
    const now = new Date().toISOString()
    const task: TransferTask = {
      id: randomUUID(),
      type,
      status: 'queued',
      accountId,
      bucket,
      objectKey,
      localPath,
      createdAt: now,
      updatedAt: now
    }
    this.tasks.unshift(task)
    this.emitUpdate()
    return task
  }

  private updateTask(id: string, partial: Partial<TransferTask>): void {
    const index = this.tasks.findIndex((t) => t.id === id)
    if (index === -1) return
    this.tasks[index] = { ...this.tasks[index], ...partial, updatedAt: new Date().toISOString() }
    this.emitUpdate()
  }

  private async processQueue(): Promise<void> {
    const concurrency = this.settingsService.get().transferConcurrency
    while (this.running < concurrency) {
      const next = this.tasks.find((t) => t.status === 'queued')
      if (!next) break
      this.running++
      this.runTask(next).finally(() => {
        this.running--
        this.processQueue()
      })
    }
  }

  private async runTask(task: TransferTask): Promise<void> {
    const controller = new AbortController()
    this.abortControllers.set(task.id, controller)
    this.updateTask(task.id, { status: 'running' })

    try {
      const account = this.accountService.getById(task.accountId)
      if (!account) throw new Error('账户不存在')
      const provider = this.getProvider(task.accountId)
      const credentials = accountToCredentials(
        account,
        this.accountService.getAccessKey(task.accountId),
        this.accountService.getSecret(task.accountId)
      )

      if (task.type === 'upload' && task.localPath) {
        await this.runUpload(task, provider, credentials, controller.signal)
      } else if (task.type === 'download' && task.localPath) {
        await provider.downloadObject(credentials, task.bucket, task.objectKey, task.localPath, {
          signal: controller.signal,
          onProgress: (progress) => this.applyProgress(task.id, progress)
        })
      } else if (task.type === 'delete') {
        const result = await provider.deleteObjects(credentials, task.bucket, [task.objectKey])
        if (result.failed.length > 0) {
          throw new Error(result.failed[0].error)
        }
      }

      this.uploadCheckpoints.delete(task.id)
      this.updateTask(task.id, { status: 'success', progressPercent: 100 })
    } catch (error) {
      if (controller.signal.aborted) {
        this.uploadCheckpoints.delete(task.id)
      }
      const message = error instanceof Error ? redactSensitiveText(error.message) : '任务失败'
      this.updateTask(task.id, {
        status: controller.signal.aborted ? 'cancelled' : 'failed',
        errorMessage: controller.signal.aborted ? '任务已取消' : message
      })
    } finally {
      this.abortControllers.delete(task.id)
    }
  }

  /**
   * 上传任务带指数退避自动重试。
   *
   * 只有 provider 标记为可重试的错误（网络中断、限流、5xx）才重试；每次重试
   * 复用任务检查点，已上传的分片不会被重传。
   */
  private async runUpload(
    task: TransferTask,
    provider: StorageProvider,
    credentials: ProviderCredentials,
    signal: AbortSignal
  ): Promise<void> {
    if (!task.localPath) throw new Error('缺少本地文件路径')

    const maxAttempts = MAX_UPLOAD_RETRIES + 1
    for (let attempt = 1; ; attempt++) {
      try {
        await provider.uploadObject(credentials, task.bucket, task.objectKey, task.localPath, {
          signal,
          onProgress: (progress) => this.applyProgress(task.id, progress),
          checkpoint: this.uploadCheckpoints.get(task.id),
          onCheckpoint: (checkpoint) => {
            this.uploadCheckpoints.set(task.id, checkpoint)
          }
        })
        return
      } catch (error) {
        if (signal.aborted) throw error
        if (attempt >= maxAttempts || !isRetryableUploadError(error)) throw error

        const delay = this.retryBaseDelayMs * 2 ** (attempt - 1)
        this.updateTask(task.id, {
          errorMessage: `网络异常或服务商限流，${Math.round(delay / 1000)} 秒后自动重试（${attempt}/${MAX_UPLOAD_RETRIES}）`
        })
        await abortableDelay(delay, signal)
        this.updateTask(task.id, { errorMessage: undefined })
      }
    }
  }

  private applyProgress(taskId: string, progress: TransferProgress): void {
    this.updateTask(taskId, {
      transferredBytes: progress.transferredBytes,
      totalBytes: progress.totalBytes,
      speedBytesPerSecond: progress.speedBytesPerSecond,
      estimatedRemainingSeconds: progress.estimatedRemainingSeconds,
      progressPercent: progress.progressPercent
    })
  }

  createUploadTasks(params: CreateUploadParams): TransferTask[] {
    const created: TransferTask[] = []
    for (const localPath of params.localPaths) {
      const fileName = basename(localPath)
      const key = params.prefix ? `${params.prefix}${fileName}` : fileName
      created.push(this.createTask('upload', params.accountId, params.bucket, key, localPath))
    }
    this.processQueue()
    return created
  }

  createDownloadTasks(params: CreateDownloadParams): TransferTask[] {
    const created: TransferTask[] = []
    for (const item of params.items) {
      created.push(
        this.createTask('download', params.accountId, params.bucket, item.key, item.localPath)
      )
    }
    this.processQueue()
    return created
  }

  createDeleteTasks(params: CreateDeleteParams): TransferTask[] {
    const created: TransferTask[] = []
    for (const key of params.keys) {
      created.push(this.createTask('delete', params.accountId, params.bucket, key))
    }
    this.processQueue()
    return created
  }

  cancel(taskId: string): void {
    const controller = this.abortControllers.get(taskId)
    if (controller) {
      controller.abort()
    } else {
      const task = this.tasks.find((t) => t.id === taskId)
      if (task?.status === 'queued') {
        this.updateTask(taskId, { status: 'cancelled' })
      }
    }
  }

  retry(taskId: string): void {
    const task = this.tasks.find((t) => t.id === taskId)
    if (!task || task.status !== 'failed') return
    this.updateTask(taskId, {
      status: 'queued',
      errorMessage: undefined,
      progressPercent: 0,
      transferredBytes: 0
    })
    this.processQueue()
  }

  clearCompleted(): void {
    const removed = this.tasks.filter((t) => t.status === 'success' || t.status === 'cancelled')
    removed.forEach((task) => this.uploadCheckpoints.delete(task.id))
    this.tasks = this.tasks.filter((t) => t.status !== 'success' && t.status !== 'cancelled')
    this.emitUpdate()
  }
}
