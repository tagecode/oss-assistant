import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const listBucketsMock = vi.fn()
  const listMock = vi.fn()
  class MockOSS {
    listBuckets = listBucketsMock
    list = listMock
    constructor() {
      /* mock client */
    }
  }
  return { listBucketsMock, listMock, MockOSS }
})

vi.mock('ali-oss', () => ({
  default: mocks.MockOSS
}))

import { AliyunOssProvider } from '../../../src/main/providers/aliyun-oss-provider'

const credentials = {
  accessKeyId: 'AKID',
  secretKey: 'SECRET',
  region: 'oss-cn-hangzhou'
}

describe('AliyunOssProvider', () => {
  beforeEach(() => {
    mocks.listBucketsMock.mockReset()
    mocks.listMock.mockReset()
  })

  it('lists buckets with metadata', async () => {
    mocks.listBucketsMock.mockResolvedValue({
      buckets: [
        {
          name: 'my-bucket',
          region: 'oss-cn-hangzhou',
          creationDate: '2026-01-15T08:00:00.000Z'
        }
      ]
    })

    const provider = new AliyunOssProvider()
    const buckets = await provider.listBuckets(credentials)

    expect(buckets).toEqual([
      {
        name: 'my-bucket',
        region: 'oss-cn-hangzhou',
        createdAt: '2026-01-15T08:00:00.000Z',
        permission: 'unknown'
      }
    ])
  })

  it('lists objects with storage class and pagination marker', async () => {
    mocks.listMock.mockResolvedValue({
      prefixes: ['images/'],
      objects: [
        {
          name: 'logo.png',
          size: 2048,
          lastModified: '2026-06-01T00:00:00.000Z',
          etag: '"abc"',
          storageClass: 'Standard'
        }
      ],
      isTruncated: true,
      nextMarker: 'next-page'
    })

    const provider = new AliyunOssProvider()
    const result = await provider.listObjects(credentials, 'my-bucket', '', 'page-1')

    expect(result.objects).toHaveLength(2)
    expect(result.hasMore).toBe(true)
    expect(result.nextMarker).toBe('next-page')
    expect(result.objects[1]).toMatchObject({
      key: 'logo.png',
      storageClass: 'Standard',
      isDirectory: false
    })
    expect(mocks.listMock).toHaveBeenCalledWith(
      expect.objectContaining({ marker: 'page-1', delimiter: '/' })
    )
  })
})
