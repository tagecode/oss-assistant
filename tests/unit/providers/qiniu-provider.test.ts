import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { QiniuProvider } from '../../../src/main/providers/qiniu-provider'

const listPrefixMock = vi.fn()
const listBucketMock = vi.fn()
const getBucketInfoMock = vi.fn()
const { resumePutStreamMock, recorderGetSyncMock, recorderDeleteSyncMock, putExtraCreateMock } =
  vi.hoisted(() => ({
    resumePutStreamMock: vi.fn(),
    recorderGetSyncMock: vi.fn(),
    recorderDeleteSyncMock: vi.fn(),
    putExtraCreateMock: vi.fn()
  }))

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

  class MockResumeUploader {
    putStreamV2 = resumePutStreamMock
  }

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
    },
    resume_up: {
      ResumeUploader: MockResumeUploader,
      PutExtra: { create: putExtraCreateMock },
      createResumeRecorderSync: () => ({
        getSync: recorderGetSyncMock,
        deleteSync: recorderDeleteSyncMock
      })
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

  it('uploads large files through the resumable v2 uploader with a checkpoint', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oss-assistant-qiniu-'))
    const filePath = join(dir, 'large.bin')
    writeFileSync(filePath, Buffer.alloc(9 * 1024 * 1024, 2))

    recorderGetSyncMock.mockReturnValue(undefined)
    putExtraCreateMock.mockImplementation(
      (
        _fname: string | undefined,
        _params: unknown,
        _mime: string | undefined,
        _record: string | undefined,
        progressCallback: (uploaded: number, total: number) => void,
        partSize: number
      ) => ({ progressCallback, partSize })
    )
    resumePutStreamMock.mockImplementation(
      async (
        _token: string,
        _key: string,
        _stream: unknown,
        total: number,
        extra: { progressCallback: (uploaded: number, total: number) => void }
      ) => {
        extra.progressCallback(total, total)
        return { ok: () => true }
      }
    )

    const provider = new QiniuProvider()
    const onCheckpoint = vi.fn()
    const onProgress = vi.fn()

    await provider.uploadObject(credentials, 'assets', 'large.bin', filePath, {
      onCheckpoint,
      onProgress
    })

    expect(putExtraCreateMock).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
      undefined,
      expect.any(Function),
      4 * 1024 * 1024,
      'v2',
      undefined,
      expect.anything(),
      expect.any(String)
    )

    const checkpoint = onCheckpoint.mock.calls.at(-1)?.[0]
    expect(checkpoint).toMatchObject({ partSize: 4 * 1024 * 1024 })
    expect(checkpoint.resumeKey).toEqual(expect.any(String))
    expect(recorderDeleteSyncMock).toHaveBeenCalledWith(checkpoint.resumeKey)
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ progressPercent: 100 }))
  })

  it('cancels a resumable upload and clears its resume record', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oss-assistant-qiniu-'))
    const filePath = join(dir, 'large.bin')
    writeFileSync(filePath, Buffer.alloc(9 * 1024 * 1024, 5))

    recorderGetSyncMock.mockReturnValue(undefined)
    putExtraCreateMock.mockReturnValue({})
    resumePutStreamMock.mockImplementation(() => new Promise(() => {}))

    const provider = new QiniuProvider()
    const controller = new AbortController()
    let resumeKey: string | undefined
    const upload = provider.uploadObject(credentials, 'assets', 'large.bin', filePath, {
      signal: controller.signal,
      onCheckpoint: (checkpoint) => {
        resumeKey = checkpoint.resumeKey
      }
    })

    await vi.waitFor(() => {
      expect(resumeKey).toBeDefined()
    })
    controller.abort()
    await expect(upload).rejects.toThrow()
    expect(recorderDeleteSyncMock).toHaveBeenCalledWith(resumeKey)
  })
})
