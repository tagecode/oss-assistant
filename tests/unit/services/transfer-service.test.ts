import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { TransferProgress } from '../../../src/shared/types/storage'
import { AccountService } from '../../../src/main/services/account-service'
import { CredentialService } from '../../../src/main/services/credential-service'
import { SettingsService } from '../../../src/main/services/settings-service'
import { TransferService } from '../../../src/main/services/transfer-service'
import type { StorageProvider } from '../../../src/main/providers/base-provider'

function createMockProvider(overrides: Partial<StorageProvider> = {}): StorageProvider {
  return {
    testConnection: vi.fn(),
    listBuckets: vi.fn(),
    listObjects: vi.fn(),
    uploadObject: vi.fn(async (_c, _b, _k, _p, onProgress?: (p: TransferProgress) => void) => {
      onProgress?.({
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
})
