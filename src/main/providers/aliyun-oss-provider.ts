import OSS from 'ali-oss'
import { createReadStream, createWriteStream } from 'fs'
import { stat } from 'fs/promises'
import { pipeline } from 'stream/promises'
import type { BucketInfo, ListObjectsResult, StorageObject } from '../../shared/types/storage'
import { type ProviderCredentials, type StorageProvider, calcProgress } from './base-provider'
import { parseAliyunBucketAcl } from './bucket-access'
import { mapError } from './provider-errors'

export class AliyunOssProvider implements StorageProvider {
  private createClient(credentials: ProviderCredentials, bucket?: string): OSS {
    return new OSS({
      accessKeyId: credentials.accessKeyId,
      accessKeySecret: credentials.secretKey,
      region: credentials.region || 'oss-cn-hangzhou',
      bucket,
      endpoint: credentials.endpoint
    })
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
      const result = await client.listBuckets()
      return Promise.all(
        (result.buckets || []).map(async (b) => {
          let permission = parseAliyunBucketAcl(undefined)
          try {
            const bucketClient = this.createClient(credentials, b.name)
            const aclResult = await bucketClient.getBucketACL(b.name)
            permission = parseAliyunBucketAcl(aclResult.acl)
          } catch {
            // Keep unknown when ACL lookup is unavailable.
          }

          return {
            name: b.name,
            region: b.region,
            createdAt: b.creationDate,
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
      const client = this.createClient(credentials, bucket)
      const result = await client.list({
        prefix,
        delimiter: '/',
        'max-keys': 1000,
        marker
      })

      const dirObjects: StorageObject[] = (result.prefixes || []).map((p: string) => ({
        key: p,
        name: p.replace(prefix, '').replace(/\/$/, ''),
        prefix,
        size: 0,
        isDirectory: true
      }))

      const fileObjects: StorageObject[] = (result.objects || [])
        .filter((item) => item.name !== prefix)
        .map((item) => ({
          key: item.name,
          name: item.name.replace(prefix, ''),
          prefix,
          size: item.size,
          lastModified: item.lastModified,
          etag: item.etag,
          storageClass: item.storageClass,
          isDirectory: false
        }))

      return {
        objects: [...dirObjects, ...fileObjects],
        prefix,
        hasMore: result.isTruncated,
        nextMarker: result.nextMarker
      }
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
    try {
      const fileStat = await stat(localPath)
      const total = fileStat.size
      const startTime = Date.now()

      const client = this.createClient(credentials, bucket)
      const stream = createReadStream(localPath)
      let transferred = 0
      stream.on('data', (chunk: string | Buffer) => {
        transferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
        onProgress?.(calcProgress(transferred, total, startTime))
      })

      if (signal?.aborted) throw new Error('上传已取消')
      await client.putStream(key, stream)
      onProgress?.(calcProgress(total, total, startTime))
    } catch (error) {
      throw mapError(error)
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
      const client = this.createClient(credentials, bucket)
      const result = await client.getStream(key)
      const startTime = Date.now()
      let transferred = 0

      const writer = createWriteStream(localPath)
      const stream = result.stream
      stream.on('data', (chunk: string | Buffer) => {
        transferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
        onProgress?.(calcProgress(transferred, transferred, startTime))
      })

      if (signal?.aborted) throw new Error('下载已取消')
      await pipeline(stream, writer)
      onProgress?.(calcProgress(transferred, transferred, startTime))
    } catch (error) {
      throw mapError(error)
    }
  }

  async deleteObjects(
    credentials: ProviderCredentials,
    bucket: string,
    keys: string[]
  ): Promise<{ succeeded: string[]; failed: { key: string; error: string }[] }> {
    const succeeded: string[] = []
    const failed: { key: string; error: string }[] = []

    try {
      const client = this.createClient(credentials, bucket)
      const result = await client.deleteMulti(keys, { quiet: false })
      ;(result.deleted || []).forEach((d: { Key: string }) => succeeded.push(d.Key))
      ;(result.errors || []).forEach((e: { Key: string; Message: string }) =>
        failed.push({ key: e.Key, error: e.Message })
      )
    } catch (error) {
      const err = mapError(error)
      keys.forEach((key) => failed.push({ key, error: err.message }))
    }

    return { succeeded, failed }
  }
}
