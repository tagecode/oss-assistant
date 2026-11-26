import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AccountService } from '../../../src/main/services/account-service'
import { CredentialService } from '../../../src/main/services/credential-service'
import { SettingsService } from '../../../src/main/services/settings-service'
import { TransferService } from '../../../src/main/services/transfer-service'
import type { StorageProvider, UploadOptions } from '../../../src/main/providers/base-provider'

function createMockProvider(overrides: Partial<StorageProvider> = {}): StorageProvider {
  return {
    testConnection: vi.fn(),
    listBuckets: vi.fn(),
    listObjects: vi.fn(),
    uploadObject: vi.fn(async (_c, _b, _k, _p, options: UploadOptions = {}) => {
      options.onProgress?.({
        transferredBytes: 100,
        totalBytes: 100,
        speedBytesPerSecond: 1000,
        estimatedRemainingSeconds: 0,
        progressPercent: 100
      })
    }),
    downloadObject: vi.fn(),
    deleteObjects: vi.fn().mockResolvedValue({ succeeded: ['file.txt'], failed: [] }),
    ...overrides
  }
}

describe('TransferService', () => {
  let accountId: string
  let transferService: TransferService

  beforeEach(() => {
    const accountService = new AccountService(new CredentialService())
    const created = accountService.create({
      name: '传输测试',
      provider: 'qiniu',
      accessKeyId: 'AKID',
      secretKey: 'SECRET'
    })
    accountId = created.id

    const settingsService = new SettingsService()
    settingsService.update({ transferConcurrency: 1 })

    transferService = new TransferService(accountService, settingsService, {
      qiniu: createMockProvider()
    })
  })

  it('runs upload task to success with progress', async () => {
    transferService.createUploadTasks({
      accountId,
      bucket: 'demo',
      prefix: '',
      localPaths: ['C:/tmp/demo.txt']
    })

    await vi.waitFor(() => {
      const task = transferService.list()[0]
      expect(task.status).toBe('success')
      expect(task.progressPercent).toBe(100)
    })
  })

  it('cancels queued task', async () => {
    const blockingProvider = createMockProvider({
      uploadObject: vi.fn(() => new Promise(() => {}))
    })
    const accountService = new AccountService(new CredentialService())
    const created = accountService.create({
      name: '取消测试',
      provider: 'qiniu',
      accessKeyId: 'AKID',
      secretKey: 'SECRET'
    })
    const settingsService = new SettingsService()
    settingsService.update({ transferConcurrency: 1 })
    const service = new TransferService(accountService, settingsService, {
      qiniu: blockingProvider
    })

    service.createUploadTasks({
      accountId: created.id,
      bucket: 'demo',
      prefix: '',
      localPaths: ['C:/tmp/a.txt', 'C:/tmp/b.txt']
    })

    await vi.waitFor(() => {
      expect(service.list().some((t) => t.status === 'running')).toBe(true)
    })

    const queuedTask = service.list().find((t) => t.status === 'queued')
    expect(queuedTask).toBeDefined()
    service.cancel(queuedTask!.id)
    expect(service.list().find((t) => t.id === queuedTask!.id)?.status).toBe('cancelled')
  })

  it('retries failed task', async () => {
    let attempts = 0
    const failingProvider = createMockProvider({
      uploadObject: vi.fn(async () => {
        attempts += 1
        if (attempts === 1) throw new Error('network')
      })
    })

    const accountService = new AccountService(new CredentialService())
    const created = accountService.create({
      name: '重试测试',
      provider: 'qiniu',
      accessKeyId: 'AKID',
      secretKey: 'SECRET'
    })
    const service = new TransferService(accountService, new SettingsService(), {
      qiniu: failingProvider
    })

    const [task] = service.createUploadTasks({
      accountId: created.id,
      bucket: 'demo',
      prefix: '',
      localPaths: ['C:/tmp/retry.txt']
    })

    await vi.waitFor(() => {
      expect(service.list().find((t) => t.id === task.id)?.status).toBe('failed')
    })

    service.retry(task.id)
    await vi.waitFor(() => {
      expect(service.list().find((t) => t.id === task.id)?.status).toBe('success')
    })
  })

  it('automatically retries retryable upload errors and reuses the checkpoint', async () => {
    const attempts: (string | undefined)[] = []
    const checkpointSeen: (string | undefined)[] = []

    const flakyProvider = createMockProvider({
      uploadObject: vi.fn(async (_c, _b, _k, _p, options: UploadOptions = {}) => {
        attempts.push(options.checkpoint?.uploadId)
        options.onCheckpoint?.({
          partSize: 8 * 1024 * 1024,
          uploadId: 'upload-1',
          parts: [{ partNumber: 1, etag: '"etag-1"' }]
        })
        if (attempts.length === 1) {
          throw Object.assign(new Error('rate limited'), { retryable: true })
        }
        checkpointSeen.push(options.checkpoint?.uploadId)
      })
    })

    const accountService = new AccountService(new CredentialService())
    const created = accountService.create({
      name: '自动重试',
      provider: 'qiniu',
      accessKeyId: 'AKID',
      secretKey: 'SECRET'
    })
    const settingsService = new SettingsService()
    settingsService.update({ transferConcurrency: 1 })
    const service = new TransferService(
      accountService,
      settingsService,
      { qiniu: flakyProvider },
      1
    )

    const [task] = service.createUploadTasks({
      accountId: created.id,
      bucket: 'demo',
      prefix: '',
      localPaths: ['C:/tmp/flaky.txt']
    })

    await vi.waitFor(() => {
      expect(service.list().find((t) => t.id === task.id)?.status).toBe('success')
    })

    expect(attempts).toEqual([undefined, 'upload-1'])
    expect(checkpointSeen).toEqual(['upload-1'])
  })

  it('does not retry non-retryable upload errors', async () => {
    const uploadMock = vi.fn(async () => {
      throw new Error('认证失败')
    })
    const provider = createMockProvider({ uploadObject: uploadMock })

    const accountService = new AccountService(new CredentialService())
    const created = accountService.create({
      name: '不可重试',
      provider: 'qiniu',
      accessKeyId: 'AKID',
      secretKey: 'SECRET'
    })
    const service = new TransferService(accountService, new SettingsService(), {
      qiniu: provider
    })

    const [task] = service.createUploadTasks({
      accountId: created.id,
      bucket: 'demo',
      prefix: '',
      localPaths: ['C:/tmp/denied.txt']
    })

    await vi.waitFor(() => {
      expect(service.list().find((t) => t.id === task.id)?.status).toBe('failed')
    })
    expect(uploadMock).toHaveBeenCalledTimes(1)
  })
})

describe('TransferService downloads, deletes and queue limits', () => {
  let accountId: string

  function createService(
    providerOverrides: Partial<StorageProvider> = {},
    concurrency = 1
  ): TransferService {
    const accountService = new AccountService(new CredentialService())
    const created = accountService.create({
      name: '下载测试',
      provider: 'qiniu',
      accessKeyId: 'AKID',
      secretKey: 'SECRET'
    })
    accountId = created.id
    const settingsService = new SettingsService()
    settingsService.update({ transferConcurrency: concurrency })
    return new TransferService(accountService, settingsService, {
      qiniu: createMockProvider(providerOverrides)
    })
  }

  it('downloads an object and reports progress', async () => {
    const progress = vi.fn()
    const service = createService({
      downloadObject: vi.fn(async (_c, _b, _k, _p, options = {}) => {
        progress()
        options.onProgress?.({
          transferredBytes: 50,
          totalBytes: 100,
          speedBytesPerSecond: 50,
          estimatedRemainingSeconds: 1,
          progressPercent: 50
        })
      })
    })

    const [task] = service.createDownloadTasks({
      accountId,
      bucket: 'demo',
      items: [{ key: 'docs/a.txt', localPath: '/tmp/a.txt' }]
    })

    await vi.waitFor(() => {
      expect(service.list().find((t) => t.id === task.id)?.status).toBe('success')
    })

    expect(progress).toHaveBeenCalledOnce()
    const finished = service.list().find((t) => t.id === task.id)!
    expect(finished.progressPercent).toBe(100)
    expect(finished.localPath).toBe('/tmp/a.txt')
    expect(finished.objectKey).toBe('docs/a.txt')
  })

  it('fails a download without retrying', async () => {
    const downloadObject = vi.fn().mockRejectedValue(new Error('403 Forbidden'))
    const service = createService({ downloadObject })

    const [task] = service.createDownloadTasks({
      accountId,
      bucket: 'demo',
      items: [{ key: 'docs/a.txt', localPath: '/tmp/a.txt' }]
    })

    await vi.waitFor(() => {
      expect(service.list().find((t) => t.id === task.id)?.status).toBe('failed')
    })

    expect(downloadObject).toHaveBeenCalledOnce()
    expect(service.list().find((t) => t.id === task.id)?.errorMessage).toBe('403 Forbidden')
  })

  it('marks a delete task failed when the provider reports a failed key', async () => {
    const service = createService({
      deleteObjects: vi.fn().mockResolvedValue({
        succeeded: [],
        failed: [{ key: 'a.txt', error: 'access denied' }]
      })
    })

    const [task] = service.createDeleteTasks({
      accountId,
      bucket: 'demo',
      keys: ['a.txt']
    })

    await vi.waitFor(() => {
      expect(service.list().find((t) => t.id === task.id)?.status).toBe('failed')
    })
    expect(service.list().find((t) => t.id === task.id)?.errorMessage).toBe('access denied')
  })

  it('completes a delete task when the provider succeeds', async () => {
    const service = createService({
      deleteObjects: vi.fn().mockResolvedValue({ succeeded: ['a.txt'], failed: [] })
    })

    const [task] = service.createDeleteTasks({
      accountId,
      bucket: 'demo',
      keys: ['a.txt']
    })

    await vi.waitFor(() => {
      expect(service.list().find((t) => t.id === task.id)?.status).toBe('success')
    })
    expect(service.list().find((t) => t.id === task.id)?.objectKey).toBe('a.txt')
  })

  it('respects transferConcurrency while draining the queue', async () => {
    let active = 0
    let maxActive = 0
    const releases: (() => void)[] = []
    const uploadObject = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          active += 1
          maxActive = Math.max(maxActive, active)
          releases.push(() => {
            active -= 1
            resolve()
          })
        })
    )
    const service = createService({ uploadObject }, 2)

    service.createUploadTasks({
      accountId,
      bucket: 'demo',
      prefix: '',
      localPaths: ['a.txt', 'b.txt', 'c.txt']
    })

    await vi.waitFor(() => {
      expect(uploadObject).toHaveBeenCalledTimes(2)
    })
    expect(maxActive).toBe(2)
    expect(service.list().filter((t) => t.status === 'queued')).toHaveLength(1)

    releases.shift()!()
    await vi.waitFor(() => {
      expect(uploadObject).toHaveBeenCalledTimes(3)
    })
    expect(maxActive).toBe(2)

    releases.splice(0).forEach((release) => release())
    await vi.waitFor(() => {
      expect(service.list().every((t) => t.status === 'success')).toBe(true)
    })
    expect(maxActive).toBe(2)
  })

  it('cancels an in-flight download', async () => {
    const downloadObject = vi.fn(
      (_c: unknown, _b: unknown, _k: unknown, _p: unknown, options = {}) =>
        new Promise<void>((_resolve, reject) => {
          if (options.signal?.aborted) {
            reject(new Error('aborted'))
            return
          }
          options.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true
          })
        })
    )
    const service = createService({ downloadObject })

    const [task] = service.createDownloadTasks({
      accountId,
      bucket: 'demo',
      items: [{ key: 'docs/a.txt', localPath: '/tmp/a.txt' }]
    })

    await vi.waitFor(() => {
      expect(service.list().find((t) => t.id === task.id)?.status).toBe('running')
    })
    service.cancel(task.id)

    await vi.waitFor(() => {
      expect(service.list().find((t) => t.id === task.id)?.status).toBe('cancelled')
    })
    expect(service.list().find((t) => t.id === task.id)?.errorMessage).toBe('任务已取消')
  })

  it('clears successful and cancelled tasks but keeps failed ones', async () => {
    const service = createService({
      uploadObject: vi.fn(async (_c, _b, key) => {
        if (key === 'bad.txt') throw new Error('permanent failure')
      })
    })

    service.createUploadTasks({
      accountId,
      bucket: 'demo',
      prefix: '',
      localPaths: ['ok.txt']
    })
    await vi.waitFor(() => {
      expect(service.list().every((t) => t.status === 'success')).toBe(true)
    })

    const [failed] = service.createUploadTasks({
      accountId,
      bucket: 'demo',
      prefix: '',
      localPaths: ['bad.txt']
    })
    await vi.waitFor(() => {
      expect(service.list().find((t) => t.id === failed.id)?.status).toBe('failed')
    })

    service.clearCompleted()

    expect(service.list().some((t) => t.status === 'success')).toBe(false)
    expect(service.list().some((t) => t.status === 'cancelled')).toBe(false)
    expect(service.list().find((t) => t.id === failed.id)?.status).toBe('failed')
  })
})
