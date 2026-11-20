import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  GetBucketAclCommand,
  GetBucketLocationCommand,
  HeadBucketCommand,
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand
} from '@aws-sdk/client-s3'
import { createReadStream, createWriteStream } from 'fs'
import type { Stats } from 'fs'
import { stat } from 'fs/promises'
import { Transform } from 'stream'
import { pipeline } from 'stream/promises'
import type { BucketInfo, ListObjectsResult, StorageObject } from '../../shared/types/storage'
import {
  type ProviderCredentials,
  type StorageProvider,
  type TransferOptions,
  type UploadOptions,
  calcProgress
} from './base-provider'
import {
  MULTIPART_PART_SIZE_BYTES,
  MULTIPART_THRESHOLD_BYTES,
  countParts,
  isCheckpointStale,
  partByteRange,
  resolvePartSize,
  throwIfAborted
} from './multipart'
import {
  extractAwsBucketRegionFromError,
  isAwsBucketEndpointError,
  normalizeAwsBucketRegion
} from './s3-aws-utils'
import { parseS3BucketGrants } from './bucket-access'
import { mapError } from './provider-errors'

/** uploadId 已被服务端回收或分片列表损坏时，重新发起一次分片上传。 */
function isRestartableMultipartError(error: unknown): boolean {
  const name =
    typeof error === 'object' && error !== null ? (error as { name?: string }).name : undefined
  return name === 'NoSuchUpload' || name === 'InvalidPart' || name === 'InvalidPartOrder'
}

export class S3Provider implements StorageProvider {
  private readonly bucketRegionCache = new Map<string, string>()

  private isAwsS3(credentials: ProviderCredentials): boolean {
    return credentials.provider === 'aws-s3'
  }

  private resolveEndpoint(credentials: ProviderCredentials): string | undefined {
    if (this.isAwsS3(credentials)) {
      return undefined
    }

    const endpoint = credentials.endpoint?.trim()
    return endpoint || undefined
  }

  private createClient(credentials: ProviderCredentials, regionOverride?: string): S3Client {
    const isAwsS3 = this.isAwsS3(credentials)

    return new S3Client({
      region: regionOverride || credentials.region || 'us-east-1',
      endpoint: this.resolveEndpoint(credentials),
      forcePathStyle: credentials.pathStyleAccess ?? false,
      followRegionRedirects: isAwsS3,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretKey
      }
    })
  }

  private bucketCacheKey(credentials: ProviderCredentials, bucket: string): string {
    return `${credentials.accessKeyId}:${bucket}`
  }

  private rememberBucketRegion(
    credentials: ProviderCredentials,
    bucket: string,
    region: string
  ): string {
    const normalized = normalizeAwsBucketRegion(region)
    this.bucketRegionCache.set(this.bucketCacheKey(credentials, bucket), normalized)
    return normalized
  }

  private async getBucketRegion(credentials: ProviderCredentials, bucket: string): Promise<string> {
    const cacheKey = this.bucketCacheKey(credentials, bucket)
    const cached = this.bucketRegionCache.get(cacheKey)
    if (cached) return cached

    const discoveryClient = this.createClient(credentials, 'us-east-1')

    try {
      const response = await discoveryClient.send(new HeadBucketCommand({ Bucket: bucket }))
      return this.rememberBucketRegion(credentials, bucket, response.BucketRegion || 'us-east-1')
    } catch (error) {
      const regionFromError = extractAwsBucketRegionFromError(error)
      if (regionFromError) {
        return this.rememberBucketRegion(credentials, bucket, regionFromError)
      }
    }

    try {
      const response = await discoveryClient.send(new GetBucketLocationCommand({ Bucket: bucket }))
      return this.rememberBucketRegion(
        credentials,
        bucket,
        response.LocationConstraint || 'us-east-1'
      )
    } catch (error) {
      const regionFromError = extractAwsBucketRegionFromError(error)
      if (regionFromError) {
        return this.rememberBucketRegion(credentials, bucket, regionFromError)
      }
      throw error
    }
  }

  private async getClientForBucket(
    credentials: ProviderCredentials,
    bucket: string,
    regionOverride?: string
  ): Promise<S3Client> {
    if (!this.isAwsS3(credentials)) {
      return this.createClient(credentials)
    }

    const bucketRegion = regionOverride || (await this.getBucketRegion(credentials, bucket))
    return this.createClient(credentials, bucketRegion)
  }

  private async withBucketClient<T>(
    credentials: ProviderCredentials,
    bucket: string,
    operation: (client: S3Client) => Promise<T>
  ): Promise<T> {
    try {
      const client = await this.getClientForBucket(credentials, bucket)
      return await operation(client)
    } catch (error) {
      if (!this.isAwsS3(credentials) || !isAwsBucketEndpointError(error)) {
        throw error
      }

      const redirectRegion = extractAwsBucketRegionFromError(error)
      if (!redirectRegion) {
        throw error
      }

      this.rememberBucketRegion(credentials, bucket, redirectRegion)
      const retryClient = await this.getClientForBucket(credentials, bucket, redirectRegion)
      return await operation(retryClient)
    }
  }

  async testConnection(credentials: ProviderCredentials): Promise<void> {
    try {
      await this.listBuckets(credentials)
    } catch (error) {
      throw mapError(error)
    }
  }

  async listBuckets(credentials: ProviderCredentials): Promise<BucketInfo[]> {
    try {
      const client = this.createClient(credentials)
      const response = await client.send(new ListBucketsCommand({}))

      return Promise.all(
        (response.Buckets || []).map(async (b) => {
          const name = b.Name || ''
          let region: string | undefined
          let permission = parseS3BucketGrants(undefined)

          try {
            if (this.isAwsS3(credentials)) {
              region = await this.getBucketRegion(credentials, name)
            }
            const bucketClient = await this.getClientForBucket(credentials, name, region)
            const aclResponse = await bucketClient.send(new GetBucketAclCommand({ Bucket: name }))
            permission = parseS3BucketGrants(aclResponse.Grants)
          } catch {
            // Keep unknown when ACL lookup is unavailable.
          }

          return {
            name,
            createdAt: b.CreationDate?.toISOString(),
            region,
            permission
          }
        })
      )
    } catch (error) {
      throw mapError(error)
    }
  }

  async listObjects(
    credentials: ProviderCredentials,
    bucket: string,
    prefix = '',
    marker?: string
  ): Promise<ListObjectsResult> {
    try {
      return await this.withBucketClient(credentials, bucket, async (client) => {
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            Delimiter: '/',
            ContinuationToken: marker,
            MaxKeys: 1000
          })
        )

        const dirObjects: StorageObject[] = (response.CommonPrefixes || []).map((p) => ({
          key: p.Prefix || '',
          name: (p.Prefix || '').replace(prefix, '').replace(/\/$/, ''),
          prefix,
          size: 0,
          isDirectory: true
        }))

        const fileObjects: StorageObject[] = (response.Contents || [])
          .filter((item) => item.Key !== prefix)
          .map((item) => ({
            key: item.Key || '',
            name: (item.Key || '').replace(prefix, ''),
            prefix,
            size: item.Size || 0,
            lastModified: item.LastModified?.toISOString(),
            storageClass: item.StorageClass,
            isDirectory: false
          }))

        return {
          objects: [...dirObjects, ...fileObjects],
          prefix,
          hasMore: response.IsTruncated || false,
          nextMarker: response.NextContinuationToken
        }
      })
    } catch (error) {
      throw mapError(error)
    }
  }

  async uploadObject(
    credentials: ProviderCredentials,
    bucket: string,
    key: string,
    localPath: string,
    options: UploadOptions = {}
  ): Promise<void> {
    try {
      throwIfAborted(options.signal)
      const fileStat = await stat(localPath)
      const total = fileStat.size
      const startTime = Date.now()

      if (total > MULTIPART_THRESHOLD_BYTES) {
        await this.uploadMultipart(credentials, bucket, key, localPath, {
          ...options,
          total,
          startTime,
          fileSize: fileStat.size,
          fileMtimeMs: fileStat.mtimeMs
        })
      } else {
        await this.uploadSingle(credentials, bucket, key, localPath, {
          ...options,
          total,
          startTime
        })
      }
    } catch (error) {
      throw mapError(error)
    }
  }

  /** 小于分片阈值的文件用单次 PutObject，省去三次往返。 */
  private async uploadSingle(
    credentials: ProviderCredentials,
    bucket: string,
    key: string,
    localPath: string,
    options: UploadOptions & { total: number; startTime: number }
  ): Promise<void> {
    const fileStream = createReadStream(localPath)
    let transferred = 0
    const progressStream = new Transform({
      transform: (chunk: Buffer | string, _encoding, callback) => {
        transferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
        options.onProgress?.(calcProgress(transferred, options.total, options.startTime))
        callback(null, chunk)
      }
    })

    fileStream.pipe(progressStream)

    const abortUpload = (): void => {
      fileStream.destroy()
      progressStream.destroy()
    }

    options.signal?.addEventListener('abort', abortUpload, { once: true })

    try {
      await this.withBucketClient(credentials, bucket, async (client) => {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: progressStream,
            ContentLength: options.total
          }),
          { abortSignal: options.signal }
        )
      })
      options.onProgress?.(calcProgress(options.total, options.total, options.startTime))
    } finally {
      options.signal?.removeEventListener('abort', abortUpload)
      abortUpload()
    }
  }

  /**
   * 大文件分片上传。
   *
   * 每个分片独立请求并携带 AbortSignal，取消时立即中断当前分片；已成功分片
   * 的 uploadId + ETag 通过 onCheckpoint 交给任务层，重试时从断点继续，避免
   * 整个文件重传。S3 单个 PutObject 上限 5GB，分片路径同时解决这个硬限制。
   */
  private async uploadMultipart(
    credentials: ProviderCredentials,
    bucket: string,
    key: string,
    localPath: string,
    options: UploadOptions & {
      total: number
      startTime: number
      fileSize: number
      fileMtimeMs: number
      allowRestart?: boolean
    }
  ): Promise<void> {
    const previous =
      options.checkpoint &&
      !isCheckpointStale(options.checkpoint, {
        size: options.fileSize,
        mtimeMs: options.fileMtimeMs
      } as Stats)
        ? options.checkpoint
        : undefined

    const partSize = previous?.partSize ?? resolvePartSize(options.total, MULTIPART_PART_SIZE_BYTES)
    const totalParts = countParts(options.total, partSize)
    const completed = new Map<number, string>()
    for (const part of previous?.parts ?? []) {
      completed.set(part.partNumber, part.etag)
    }

    let uploadId = previous?.uploadId

    const uploadedBytes = (): number => {
      let bytes = 0
      for (const partNumber of completed.keys()) {
        bytes += partByteRange(options.total, partSize, partNumber).size
      }
      return bytes
    }

    const emitCheckpoint = (): void => {
      if (!uploadId) return
      options.onCheckpoint?.({
        partSize,
        uploadId,
        parts: [...completed.entries()]
          .map(([partNumber, etag]) => ({ partNumber, etag }))
          .sort((a, b) => a.partNumber - b.partNumber),
        fileSize: options.fileSize,
        fileMtimeMs: options.fileMtimeMs
      })
    }

    try {
      await this.withBucketClient(credentials, bucket, async (client) => {
        if (!uploadId) {
          const created = await client.send(
            new CreateMultipartUploadCommand({ Bucket: bucket, Key: key }),
            { abortSignal: options.signal }
          )
          uploadId = created.UploadId
          if (!uploadId) throw new Error('创建分片上传失败')
          emitCheckpoint()
        }

        if (completed.size > 0) {
          options.onProgress?.(calcProgress(uploadedBytes(), options.total, options.startTime))
        }

        for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
          if (completed.has(partNumber)) continue
          throwIfAborted(options.signal)

          const { start, end, size } = partByteRange(options.total, partSize, partNumber)
          const body = createReadStream(localPath, { start, end: end - 1 })

          try {
            const response = await client.send(
              new UploadPartCommand({
                Bucket: bucket,
                Key: key,
                UploadId: uploadId,
                PartNumber: partNumber,
                Body: body,
                ContentLength: size
              }),
              { abortSignal: options.signal }
            )
            if (!response.ETag) throw new Error('分片上传未返回 ETag')
            completed.set(partNumber, response.ETag)
          } finally {
            body.destroy()
          }

          emitCheckpoint()
          options.onProgress?.(calcProgress(uploadedBytes(), options.total, options.startTime))
        }

        const parts = [...completed.entries()]
          .map(([PartNumber, ETag]) => ({ PartNumber, ETag }))
          .sort((a, b) => a.PartNumber - b.PartNumber)

        await client.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucket,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: { Parts: parts }
          }),
          { abortSignal: options.signal }
        )
      })

      options.onProgress?.(calcProgress(options.total, options.total, options.startTime))
    } catch (error) {
      if (uploadId) {
        if (options.signal?.aborted) {
          await this.abortMultipartQuietly(credentials, bucket, key, uploadId)
        } else if (options.allowRestart !== false && isRestartableMultipartError(error)) {
          // uploadId 失效（例如超时被服务端回收）时重新发起一次分片上传。
          await this.abortMultipartQuietly(credentials, bucket, key, uploadId)
          await this.uploadMultipart(credentials, bucket, key, localPath, {
            ...options,
            checkpoint: undefined,
            allowRestart: false
          })
          return
        }
      }
      throw error
    }
  }

  private async abortMultipartQuietly(
    credentials: ProviderCredentials,
    bucket: string,
    key: string,
    uploadId: string
  ): Promise<void> {
    try {
      await this.withBucketClient(credentials, bucket, async (client) => {
        await client.send(
          new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId })
        )
      })
    } catch {
      // 清理失败不影响任务结果：未完成的分片会在服务端过期回收。
    }
  }

  async downloadObject(
    credentials: ProviderCredentials,
    bucket: string,
    key: string,
    localPath: string,
    options: TransferOptions = {}
  ): Promise<void> {
    try {
      await this.withBucketClient(credentials, bucket, async (client) => {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), {
          abortSignal: options.signal
        })

        const total = Number(response.ContentLength || 0)
        const startTime = Date.now()
        let transferred = 0

        const body = response.Body
        if (!body || typeof body === 'string') throw new Error('无法读取对象内容')

        const writer = createWriteStream(localPath)
        const stream = body as NodeJS.ReadableStream
        stream.on('data', (chunk: string | Buffer) => {
          transferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
          options.onProgress?.(calcProgress(transferred, total || transferred, startTime))
        })

        await pipeline(stream, writer)
        options.onProgress?.(calcProgress(total || transferred, total || transferred, startTime))
      })
    } catch (error) {
      throw mapError(error)
    }
  }

  async deleteObjects(
    credentials: ProviderCredentials,
    bucket: string,
    keys: string[]
  ): Promise<{ succeeded: string[]; failed: { key: string; error: string }[] }> {
    try {
      return await this.withBucketClient(credentials, bucket, async (client) => {
        const response = await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: keys.map((key) => ({ Key: key })) }
          })
        )

        const succeeded = (response.Deleted || []).map((d) => d.Key || '').filter(Boolean)
        const failed = (response.Errors || []).map((e) => ({
          key: e.Key || '',
          error: e.Message || '删除失败'
        }))

        return { succeeded, failed }
      })
    } catch (error) {
      throw mapError(error)
    }
  }
}
