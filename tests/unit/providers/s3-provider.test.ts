import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { ProviderCredentials } from '../../../src/main/providers/base-provider'

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn()
}))

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class MockS3Client {
    send = sendMock
  },
  ListBucketsCommand: class ListBucketsCommand {
    constructor(public input: unknown) {}
  },
  HeadBucketCommand: class HeadBucketCommand {
    constructor(public input: unknown) {}
  },
  GetBucketLocationCommand: class GetBucketLocationCommand {
    constructor(public input: unknown) {}
  },
  ListObjectsV2Command: class ListObjectsV2Command {
    constructor(public input: unknown) {}
  },
  PutObjectCommand: class PutObjectCommand {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class GetObjectCommand {
    constructor(public input: unknown) {}
  },
  DeleteObjectsCommand: class DeleteObjectsCommand {
    constructor(public input: unknown) {}
  },
  GetBucketAclCommand: class GetBucketAclCommand {
    constructor(public input: unknown) {}
  },
  CreateMultipartUploadCommand: class CreateMultipartUploadCommand {
    constructor(public input: unknown) {}
  },
  UploadPartCommand: class UploadPartCommand {
    constructor(public input: unknown) {}
  },
  CompleteMultipartUploadCommand: class CompleteMultipartUploadCommand {
    constructor(public input: unknown) {}
  },
  AbortMultipartUploadCommand: class AbortMultipartUploadCommand {
    constructor(public input: unknown) {}
  }
}))

import { S3Provider } from '../../../src/main/providers/s3-provider'

const awsCredentials: ProviderCredentials = {
  accessKeyId: 'AKIA_TEST',
  secretKey: 'SECRET_TEST',
  provider: 'aws-s3',
  region: 'us-east-1',
  endpoint: 'https://s3.us-east-1.amazonaws.com'
}

describe('S3Provider', () => {
  beforeEach(() => {
    sendMock.mockReset()
  })

  it('uses HeadBucket region before listing objects for AWS S3', async () => {
    sendMock.mockResolvedValueOnce({ BucketRegion: 'ap-southeast-1' }).mockResolvedValueOnce({
      CommonPrefixes: [],
      Contents: [{ Key: 'readme.txt', Size: 12 }],
      IsTruncated: false
    })

    const provider = new S3Provider()
    const result = await provider.listObjects(awsCredentials, 'remote-bucket')

    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(result.objects).toHaveLength(1)
    expect(result.objects[0]?.name).toBe('readme.txt')
  })

  it('maps legacy EU bucket location to eu-west-1', async () => {
    sendMock
      .mockRejectedValueOnce(new Error('HeadBucket failed'))
      .mockResolvedValueOnce({ LocationConstraint: 'EU' })
      .mockResolvedValueOnce({
        CommonPrefixes: [],
        Contents: [],
        IsTruncated: false
      })

    const provider = new S3Provider()
    await provider.listObjects(awsCredentials, 'ireland-bucket')

    expect(sendMock).toHaveBeenCalledTimes(3)
  })

  it('retries listObjects with region parsed from redirect error', async () => {
    sendMock
      .mockResolvedValueOnce({ BucketRegion: 'us-east-1' })
      .mockRejectedValueOnce({
        message:
          'The bucket you are attempting to access must be addressed using the specified endpoint.',
        Endpoint: 'remote-bucket.s3-ap-southeast-1.amazonaws.com'
      })
      .mockResolvedValueOnce({
        CommonPrefixes: [],
        Contents: [{ Key: 'file.txt', Size: 1 }],
        IsTruncated: false
      })

    const provider = new S3Provider()
    const result = await provider.listObjects(awsCredentials, 'remote-bucket')

    expect(sendMock).toHaveBeenCalledTimes(3)
    expect(result.objects).toHaveLength(1)
  })

  it('uploads files with ContentLength without flowing stream hash errors', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'oss-assistant-upload-'))
    const filePath = join(tempDir, 'sample.txt')
    writeFileSync(filePath, 'hello aws upload')

    sendMock.mockResolvedValueOnce({ BucketRegion: 'us-east-1' }).mockResolvedValueOnce({})

    const provider = new S3Provider()
    const onProgress = vi.fn()

    await provider.uploadObject(awsCredentials, 'remote-bucket', 'sample.txt', filePath, {
      onProgress
    })

    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenCalled()
  })

  it('returns normalized bucket regions and access when listing buckets for AWS S3', async () => {
    sendMock
      .mockResolvedValueOnce({
        Buckets: [{ Name: 'ireland-bucket', CreationDate: new Date('2026-01-01T00:00:00.000Z') }]
      })
      .mockResolvedValueOnce({ BucketRegion: 'eu-west-1' })
      .mockResolvedValueOnce({
        Grants: [
          {
            Grantee: { URI: 'http://acs.amazonaws.com/groups/global/AllUsers' },
            Permission: 'READ'
          }
        ]
      })

    const provider = new S3Provider()
    const buckets = await provider.listBuckets(awsCredentials)

    expect(buckets).toEqual([
      expect.objectContaining({
        name: 'ireland-bucket',
        region: 'eu-west-1',
        permission: 'public'
      })
    ])
  })

  it('uploads large files with multipart upload and reports a resumable checkpoint', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'oss-assistant-multipart-'))
    const filePath = join(tempDir, 'large.bin')
    writeFileSync(filePath, Buffer.alloc(17 * 1024 * 1024, 7))

    const commands: { type: string; input: Record<string, unknown> }[] = []
    sendMock.mockImplementation(async (command: { input: Record<string, unknown> }) => {
      const input = command.input
      if (input.MultipartUpload) {
        commands.push({ type: 'complete', input })
        return {}
      }
      if (input.PartNumber !== undefined) {
        commands.push({ type: 'part', input })
        return { ETag: `"etag-${String(input.PartNumber)}"` }
      }
      if (input.Key !== undefined) {
        commands.push({ type: 'create', input })
        return { UploadId: 'upload-123' }
      }
      return { BucketRegion: 'us-east-1' }
    })

    const provider = new S3Provider()
    const onProgress = vi.fn()
    const onCheckpoint = vi.fn()

    await provider.uploadObject(awsCredentials, 'remote-bucket', 'large.bin', filePath, {
      onProgress,
      onCheckpoint
    })

    const partCommands = commands.filter((c) => c.type === 'part')
    expect(commands.filter((c) => c.type === 'create')).toHaveLength(1)
    expect(partCommands.map((c) => c.input.PartNumber)).toEqual([1, 2, 3])
    expect(commands.filter((c) => c.type === 'complete')).toHaveLength(1)

    const lastCheckpoint = onCheckpoint.mock.calls.at(-1)?.[0]
    expect(lastCheckpoint).toMatchObject({ uploadId: 'upload-123' })
    expect(lastCheckpoint.parts).toHaveLength(3)
    expect(onProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ progressPercent: 100, transferredBytes: 17 * 1024 * 1024 })
    )
  })

  it('resumes multipart upload from checkpoint without re-uploading finished parts', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'oss-assistant-multipart-resume-'))
    const filePath = join(tempDir, 'large.bin')
    writeFileSync(filePath, Buffer.alloc(17 * 1024 * 1024, 3))

    const partNumbers: number[] = []
    let createCalls = 0
    sendMock.mockImplementation(async (command: { input: Record<string, unknown> }) => {
      const input = command.input
      if (input.MultipartUpload) return {}
      if (input.PartNumber !== undefined) {
        partNumbers.push(Number(input.PartNumber))
        return { ETag: `"etag-${String(input.PartNumber)}"` }
      }
      if (input.Key !== undefined) {
        createCalls++
        return { UploadId: 'upload-resumed' }
      }
      return { BucketRegion: 'us-east-1' }
    })

    const provider = new S3Provider()
    await provider.uploadObject(awsCredentials, 'remote-bucket', 'large.bin', filePath, {
      checkpoint: {
        partSize: 8 * 1024 * 1024,
        uploadId: 'upload-resumed',
        parts: [{ partNumber: 1, etag: '"etag-1"' }],
        fileSize: 17 * 1024 * 1024
      }
    })

    expect(createCalls).toBe(0)
    expect(partNumbers).toEqual([2, 3])
  })

  it('aborts the multipart upload and cancels in-flight part when task is cancelled', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'oss-assistant-multipart-abort-'))
    const filePath = join(tempDir, 'large.bin')
    writeFileSync(filePath, Buffer.alloc(9 * 1024 * 1024, 1))

    const abortCommands: Record<string, unknown>[] = []
    let partStarted: (() => void) | undefined
    const partStartedPromise = new Promise<void>((resolve) => {
      partStarted = resolve
    })

    sendMock.mockImplementation(
      (command: { input: Record<string, unknown> }, options?: { abortSignal?: AbortSignal }) => {
        const input = command.input
        if (input.UploadId && !input.PartNumber && !input.MultipartUpload) {
          abortCommands.push(input)
          return Promise.resolve({})
        }
        if (input.PartNumber !== undefined) {
          partStarted?.()
          return new Promise((_resolve, reject) => {
            options?.abortSignal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
            })
          })
        }
        if (input.Key !== undefined) return Promise.resolve({ UploadId: 'upload-abort' })
        return Promise.resolve({ BucketRegion: 'us-east-1' })
      }
    )

    const provider = new S3Provider()
    const controller = new AbortController()
    const upload = provider.uploadObject(awsCredentials, 'remote-bucket', 'large.bin', filePath, {
      signal: controller.signal
    })

    await partStartedPromise
    controller.abort()
    await expect(upload).rejects.toThrow()

    expect(abortCommands).toEqual([
      expect.objectContaining({ UploadId: 'upload-abort', Key: 'large.bin' })
    ])
  })
})
