import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QiniuProvider } from '../../../src/main/providers/qiniu-provider'

const listPrefixMock = vi.fn()
const listBucketMock = vi.fn()
const getBucketInfoMock = vi.fn()

vi.mock('qiniu', () => {
  class MockMac {
    constructor(
      public accessKey: string,
      public secretKey: string
    ) {}
  }

  class MockConfig {}

  class MockBucketManager {
    listBucket = listBucketMock
    listPrefix = listPrefixMock
    getBucketInfo = getBucketInfoMock
  }

  class MockPutPolicy {
    uploadToken(): string {
      return 'token'
    }
  }

  class MockFormUploader {
    putStream = vi.fn()
  }

  class MockPutExtra {}

  return {
    auth: { digest: { Mac: MockMac } },
    conf: { Config: MockConfig, Zone_z0: 'z0' },
    zone: { Zone_z0: 'z0', Zone_z1: 'z1', Zone_z2: 'z2', Zone_na0: 'na0', Zone_as0: 'as0' },
    rs: {
      BucketManager: MockBucketManager,
      PutPolicy: MockPutPolicy,
      deleteOp: (bucket: string, key: string) => ({ bucket, key })
    },
    form_up: {
      FormUploader: MockFormUploader,
      PutExtra: MockPutExtra
    }
  }
})

const credentials = {
  accessKeyId: 'AKID',
  secretKey: 'SECRET',
  region: 'z0'
}

describe('QiniuProvider', () => {
  beforeEach(() => {
    listBucketMock.mockReset()
    listPrefixMock.mockReset()
    getBucketInfoMock.mockReset()
  })

  it('lists buckets with public/private access', async () => {
    listBucketMock.mockResolvedValue({
      ok: () => true,
      data: ['assets', 'backup']
    })
    getBucketInfoMock.mockImplementation(async (name: string) => ({
      ok: () => true,
      data: { private: name === 'assets' ? 0 : 1 }
    }))

    const provider = new QiniuProvider()
    const buckets = await provider.listBuckets(credentials)
    expect(buckets).toEqual([
      { name: 'assets', permission: 'public' },
      { name: 'backup', permission: 'private' }
    ])
  })

  it('lists objects with marker pagination', async () => {
    listPrefixMock.mockResolvedValue({
      ok: () => true,
      data: {
        items: [
          {
            key: 'logo.png',
            fsize: 1200,
            putTime: 16000000000000,
            mimeType: 'image/png'
          }
        ],
        commonPrefixes: ['images/'],
        marker: 'next-page'
      }
    })

    const provider = new QiniuProvider()
    const result = await provider.listObjects(credentials, 'assets', '', 'page-1')

    expect(result.objects).toHaveLength(2)
    expect(result.hasMore).toBe(true)
    expect(result.nextMarker).toBe('next-page')
    expect(listPrefixMock).toHaveBeenCalledWith(
      'assets',
      expect.objectContaining({ marker: 'page-1', delimiter: '/' })
    )
  })
})
