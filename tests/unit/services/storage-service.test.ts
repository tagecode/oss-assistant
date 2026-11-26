import { describe, expect, it, vi } from 'vitest'
import { StorageService } from '../../../src/main/services/storage-service'
import type { AccountService } from '../../../src/main/services/account-service'
import type { StorageProvider } from '../../../src/main/providers/base-provider'
import type { AccountConfig, AccountInput } from '../../../src/shared/types/storage'

const account: AccountConfig = {
  id: 'acc-1',
  name: '测试账户',
  provider: 'qiniu',
  encryptedAccessKeyRef: 'ak-ref',
  encryptedSecretRef: 'sk-ref',
  region: 'z0',
  bucketDomain: 'https://cdn.example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastConnectionStatus: 'unknown'
}

function createHarness(providerOverrides: Partial<StorageProvider> = {}): {
  service: StorageService
  provider: StorageProvider
  accountService: {
    getById: ReturnType<typeof vi.fn>
    getAccessKey: ReturnType<typeof vi.fn>
    getSecret: ReturnType<typeof vi.fn>
    updateConnectionStatus: ReturnType<typeof vi.fn>
  }
} {
  const provider: StorageProvider = {
    testConnection: vi.fn().mockResolvedValue(undefined),
    listBuckets: vi.fn().mockResolvedValue([]),
    listObjects: vi.fn().mockResolvedValue({ objects: [], marker: undefined }),
    uploadObject: vi.fn().mockResolvedValue(undefined),
    downloadObject: vi.fn().mockResolvedValue(undefined),
    deleteObjects: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    ...providerOverrides
  }

  const accountService = {
    getById: vi.fn((id: string) => (id === account.id ? account : undefined)),
    getAccessKey: vi.fn().mockReturnValue('AKID_STORED'),
    getSecret: vi.fn().mockReturnValue('SECRET_STORED'),
    updateConnectionStatus: vi.fn()
  }

  const service = new StorageService(accountService as unknown as AccountService, {
    qiniu: provider
  })

  return { service, provider, accountService }
}

const input: AccountInput = {
  name: '测试账户',
  provider: 'qiniu',
  accessKeyId: 'AKID_INPUT',
  secretKey: 'SECRET_INPUT',
  region: 'z0',
  bucketDomain: 'https://cdn.example.com'
}

describe('StorageService', () => {
  it('tests a new connection with input credentials and marks the account connected', async () => {
    const { service, provider, accountService } = createHarness()

    await service.testConnection(input, account.id)

    expect(provider.testConnection).toHaveBeenCalledWith({
      accessKeyId: 'AKID_INPUT',
      secretKey: 'SECRET_INPUT',
      provider: 'qiniu',
      region: 'z0',
      endpoint: undefined,
      bucketDomain: 'https://cdn.example.com',
      pathStyleAccess: undefined
    })
    expect(accountService.updateConnectionStatus).toHaveBeenCalledWith(account.id, 'connected')
  })

  it('marks the account failed and rethrows when the connection test fails', async () => {
    const { service, accountService } = createHarness({
      testConnection: vi.fn().mockRejectedValue(new Error('network down'))
    })

    await expect(service.testConnection(input, account.id)).rejects.toThrow('network down')

    expect(accountService.updateConnectionStatus).toHaveBeenCalledWith(account.id, 'failed')
  })

  it('rejects an incomplete credential pair before calling the provider', async () => {
    const { service, provider, accountService } = createHarness()

    await expect(service.testConnection({ ...input, secretKey: '' }, account.id)).rejects.toThrow(
      'Access Key ID 和 Secret Key 不能为空'
    )

    expect(provider.testConnection).not.toHaveBeenCalled()
    expect(accountService.updateConnectionStatus).not.toHaveBeenCalled()
  })

  it('tests a stored connection using the decrypted credentials', async () => {
    const { service, provider } = createHarness()

    await service.testConnectionById(account.id)

    expect(provider.testConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        accessKeyId: 'AKID_STORED',
        secretKey: 'SECRET_STORED',
        provider: 'qiniu'
      })
    )
  })

  it('rejects a connection test for an unknown account', async () => {
    const { service } = createHarness()

    await expect(service.testConnectionById('missing')).rejects.toThrow('账户不存在')
  })

  it('routes listBuckets to the account provider and updates connection status', async () => {
    const buckets = [{ name: 'demo', public: false }]
    const { service, provider, accountService } = createHarness({
      listBuckets: vi.fn().mockResolvedValue(buckets)
    })

    await expect(service.listBuckets(account.id)).resolves.toEqual(buckets)

    expect(provider.listBuckets).toHaveBeenCalledWith(
      expect.objectContaining({ accessKeyId: 'AKID_STORED', secretKey: 'SECRET_STORED' })
    )
    expect(accountService.updateConnectionStatus).toHaveBeenCalledWith(account.id, 'connected')
  })

  it('marks the account failed when listing buckets fails', async () => {
    const { service, accountService } = createHarness({
      listBuckets: vi.fn().mockRejectedValue(new Error('denied'))
    })

    await expect(service.listBuckets(account.id)).rejects.toThrow('denied')

    expect(accountService.updateConnectionStatus).toHaveBeenCalledWith(account.id, 'failed')
  })

  it('rejects a bucket listing for an unknown account', async () => {
    const { service, provider } = createHarness()

    await expect(service.listBuckets('missing')).rejects.toThrow('账户不存在')
    expect(provider.listBuckets).not.toHaveBeenCalled()
  })

  it('routes listObjects with the account credentials', async () => {
    const result = { objects: [], marker: 'next' }
    const { service, provider, accountService } = createHarness({
      listObjects: vi.fn().mockResolvedValue(result)
    })

    await expect(service.listObjects(account.id, 'demo', 'folder/', 'marker-1')).resolves.toEqual(
      result
    )

    expect(provider.listObjects).toHaveBeenCalledWith(
      expect.objectContaining({ accessKeyId: 'AKID_STORED', secretKey: 'SECRET_STORED' }),
      'demo',
      'folder/',
      'marker-1'
    )
    expect(accountService.updateConnectionStatus).not.toHaveBeenCalled()
  })

  it('rejects an unsupported provider', async () => {
    const unknownAccount = { ...account, provider: 'unknown' as AccountConfig['provider'] }
    const accountService = {
      getById: vi.fn(() => unknownAccount),
      getAccessKey: vi.fn(() => 'AKID'),
      getSecret: vi.fn(() => 'SECRET'),
      updateConnectionStatus: vi.fn()
    }
    const service = new StorageService(accountService as unknown as AccountService, {})

    await expect(service.listBuckets(account.id)).rejects.toThrow('不支持的服务商')
  })
})
