import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const mocks = vi.hoisted(() => {
  const listBucketsMock = vi.fn()
  const listMock = vi.fn()
  const getBucketAclMock = vi.fn()
  const putStreamMock = vi.fn()
  const multipartUploadMock = vi.fn()
  const cancelMock = vi.fn()
  const abortMultipartUploadMock = vi.fn()
  const getStreamMock = vi.fn()
  class MockOSS {
    listBuckets = listBucketsMock
    list = listMock
    getBucketACL = getBucketAclMock
    putStream = putStreamMock
    multipartUpload = multipartUploadMock
    cancel = cancelMock
    abortMultipartUpload = abortMultipartUploadMock
    getStream = getStreamMock
    constructor() {
      /* mock client */
    }
  }
  return {
    listBucketsMock,
    listMock,
    getBucketAclMock,
    putStreamMock,
    multipartUploadMock,
    cancelMock,
    abortMultipartUploadMock,
    getStreamMock,
    MockOSS
  }
})

vi.mock('ali-oss', () => ({
  default: mocks.MockOSS
}))

import { AliyunOssProvider } from '../../../src/main/providers/aliyun-oss-provider'
import type { UploadOptions } from '../../../src/main/providers/base-provider'

const credentials = {
  accessKeyId: 'AKID',
  secretKey: 'SECRET',
  region: 'oss-cn-hangzhou'
}

function writeLargeFile(name: string, size: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'oss-assistant-aliyun-'))
  const filePath = join(dir, name)
  writeFileSync(filePath, Buffer.alloc(size, 4))
  return filePath
}

describe('AliyunOssProvider', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => {
      if (typeof mock === 'function' && 'mockReset' in mock) {
        ;(mock as ReturnType<typeof vi.fn>).mockReset()
      }
    })
  })

  it('lists buckets with metadata and access', async () => {
    mocks.listBucketsMock.mockResolvedValue({
      buckets: [
        {
          name: 'my-bucket',
          region: 'oss-cn-hangzhou',
          creationDate: '2026-01-15T08:00:00.000Z'
        }
      ]
    })
    mocks.getBucketAclMock.mockResolvedValue({ acl: 'public-read' })

    const provider = new AliyunOssProvider()
    const buckets = await provider.listBuckets(credentials)

    expect(buckets).toEqual([
      {
        name: 'my-bucket',
        region: 'oss-cn-hangzhou',
        createdAt: '2026-01-15T08:00:00.000Z',
        permission: 'public'
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

  it('uploads small files with putStream and reports progress', async () => {
    const filePath = writeLargeFile('small.txt', 1024)
    mocks.putStreamMock.mockResolvedValue({})

    const provider = new AliyunOssProvider()
    const options: UploadOptions & { onProgress: ReturnType<typeof vi.fn> } = {
      onProgress: vi.fn()
    }

    await provider.uploadObject(credentials, 'my-bucket', 'small.txt', filePath, options)

    expect(mocks.putStreamMock).toHaveBeenCalledTimes(1)
    expect(options.onProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ progressPercent: 100 })
    )
  })

  it('uploads large files with multipartUpload and exposes an ali-oss checkpoint', async () => {
    const filePath = writeLargeFile('large.bin', 17 * 1024 * 1024)
    mocks.multipartUploadMock.mockImplementation(
      async (
        _key: string,
        _file: string,
        options: {
          partSize: number
          progress: (fraction: number, checkpoint: unknown) => void
        }
      ) => {
        options.progress(0, {
          uploadId: 'upload-1',
          doneParts: [],
          partSize: options.partSize
        })
        options.progress(1, {
          uploadId: 'upload-1',
          doneParts: [
            { number: 0, etag: '"e0"' },
            { number: 1, etag: '"e1"' },
            { number: 2, etag: '"e2"' }
          ],
          partSize: options.partSize
        })
        return {}
      }
    )

    const provider = new AliyunOssProvider()
    const onCheckpoint = vi.fn()

    await provider.uploadObject(credentials, 'my-bucket', 'large.bin', filePath, {
      onCheckpoint
    })

    expect(mocks.multipartUploadMock).toHaveBeenCalledTimes(1)
    expect(mocks.multipartUploadMock).toHaveBeenCalledWith(
      'large.bin',
      filePath,
      expect.objectContaining({ partSize: 8 * 1024 * 1024 })
    )

    const lastCheckpoint = onCheckpoint.mock.calls.at(-1)?.[0]
    expect(lastCheckpoint).toMatchObject({ uploadId: 'upload-1' })
    expect(lastCheckpoint.parts).toHaveLength(3)
  })

  it('resumes multipart upload with the persisted checkpoint', async () => {
    const filePath = writeLargeFile('large.bin', 17 * 1024 * 1024)
    mocks.multipartUploadMock.mockResolvedValue({})

    const provider = new AliyunOssProvider()
    await provider.uploadObject(credentials, 'my-bucket', 'large.bin', filePath, {
      checkpoint: {
        partSize: 8 * 1024 * 1024,
        uploadId: 'upload-resume',
        parts: [{ partNumber: 0, etag: '"e0"' }],
        fileSize: 17 * 1024 * 1024
      }
    })

    expect(mocks.multipartUploadMock).toHaveBeenCalledWith(
      'large.bin',
      filePath,
      expect.objectContaining({
        checkpoint: expect.objectContaining({
          uploadId: 'upload-resume',
          doneParts: [{ number: 0, etag: '"e0"' }]
        })
      })
    )
  })

  it('cancels an in-flight multipart upload and aborts the upload id', async () => {
    const filePath = writeLargeFile('large.bin', 9 * 1024 * 1024)
    mocks.multipartUploadMock.mockImplementation(
      (
        _key: string,
        _file: string,
        options: { progress: (fraction: number, checkpoint: unknown) => void }
      ) => {
        options.progress(0, { uploadId: 'upload-abort', doneParts: [] })
        return new Promise(() => {})
      }
    )
    mocks.abortMultipartUploadMock.mockResolvedValue({})

    const provider = new AliyunOssProvider()
    const controller = new AbortController()
    const upload = provider.uploadObject(credentials, 'my-bucket', 'large.bin', filePath, {
      signal: controller.signal
    })

    await vi.waitFor(() => {
      expect(mocks.multipartUploadMock).toHaveBeenCalled()
    })
    controller.abort()

    await expect(upload).rejects.toThrow()
    expect(mocks.cancelMock).toHaveBeenCalled()
    expect(mocks.abortMultipartUploadMock).toHaveBeenCalledWith('large.bin', 'upload-abort')
  })
})
