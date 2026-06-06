import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  GetBucketAclCommand,
  GetBucketLocationCommand,
  HeadBucketCommand
} from '@aws-sdk/client-s3'
import { createReadStream, createWriteStream } from 'fs'
import { stat } from 'fs/promises'
import { Transform } from 'stream'
import { pipeline } from 'stream/promises'
import type { BucketInfo, ListObjectsResult, StorageObject } from '../../shared/types/storage'
import { type ProviderCredentials, type StorageProvider, calcProgress } from './base-provider'
import {
  extractAwsBucketRegionFromError,
  isAwsBucketEndpointError,
  normalizeAwsBucketRegion
} from './s3-aws-utils'
import { parseS3BucketGrants } from './bucket-access'
import { mapError } from './provider-errors'

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
    onProgress?: (progress: import('../../shared/types/storage').TransferProgress) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const fileStat = await stat(localPath)
    const total = fileStat.size
    const startTime = Date.now()
    let transferred = 0

    const progressStream = new Transform({
      transform(chunk: Buffer | string, _encoding, callback) {
        transferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
        onProgress?.(calcProgress(transferred, total, startTime))
        callback(null, chunk)
      }
    })

    const fileStream = createReadStream(localPath)
    fileStream.pipe(progressStream)

    const abortUpload = (): void => {
      fileStream.destroy()
      progressStream.destroy()
    }

    if (signal?.aborted) {
      abortUpload()
      throw mapError(new Error('上传已取消'))
    }

    signal?.addEventListener('abort', abortUpload, { once: true })

    try {
      await this.withBucketClient(credentials, bucket, async (client) => {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: progressStream,
            ContentLength: total
          }),
          { abortSignal: signal }
        )
      })
      onProgress?.(calcProgress(total, total, startTime))
    } catch (error) {
      throw mapError(error)
    } finally {
      signal?.removeEventListener('abort', abortUpload)
      abortUpload()
    }
  }

  async downloadObject(
    credentials: ProviderCredentials,
    bucket: string,
    key: string,
    localPath: string,
    onProgress?: (progress: import('../../shared/types/storage').TransferProgress) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      await this.withBucketClient(credentials, bucket, async (client) => {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), {
          abortSignal: signal
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
          onProgress?.(calcProgress(transferred, total || transferred, startTime))
        })

        await pipeline(stream, writer)
        onProgress?.(calcProgress(total || transferred, total || transferred, startTime))
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
