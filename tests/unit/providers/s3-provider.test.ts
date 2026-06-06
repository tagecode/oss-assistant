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

    await provider.uploadObject(awsCredentials, 'remote-bucket', 'sample.txt', filePath, onProgress)

    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(onProgress).toHaveBeenCalled()
  })

  it('returns normalized bucket regions when listing buckets for AWS S3', async () => {
    sendMock
      .mockResolvedValueOnce({
        Buckets: [{ Name: 'ireland-bucket', CreationDate: new Date('2026-01-01T00:00:00.000Z') }]
      })
      .mockResolvedValueOnce({ BucketRegion: 'eu-west-1' })

    const provider = new S3Provider()
    const buckets = await provider.listBuckets(awsCredentials)

    expect(buckets).toEqual([
      expect.objectContaining({
        name: 'ireland-bucket',
        region: 'eu-west-1'
      })
    ])
  })
})
