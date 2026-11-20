import OSS from 'ali-oss'
import { createReadStream, createWriteStream } from 'fs'
import type { Stats } from 'fs'
import { stat } from 'fs/promises'
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
  bytesBeforePart,
  isCheckpointStale,
  rejectOnAbort,
  resolvePartSize,
  throwIfAborted
} from './multipart'
import { parseAliyunBucketAcl } from './bucket-access'
import { mapError } from './provider-errors'

/** ali-oss checkpoint 的字段结构（官方类型里没有导出，按运行时行为声明）。 */
interface AliyunMultipartCheckpoint {
  name?: string
  fileSize?: number
  partSize?: number
  uploadId?: string
  doneParts?: { number: number; etag: string }[]
}

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
    options: UploadOptions = {}
  ): Promise<void> {
    try {
      throwIfAborted(options.signal)
      const fileStat = await stat(localPath)
      const total = fileStat.size
      const startTime = Date.now()
      const client = this.createClient(credentials, bucket)

      if (total > MULTIPART_THRESHOLD_BYTES) {
        await this.uploadMultipart(client, key, localPath, {
          ...options,
          total,
          startTime,
          fileSize: fileStat.size,
          fileMtimeMs: fileStat.mtimeMs
        })
      } else {
        await this.uploadSingle(client, key, localPath, { ...options, total, startTime })
      }
    } catch (error) {
      throw mapError(error)
    }
  }

  /** 小文件单请求上传；取消时销毁数据流让 putStream 立刻失败。 */
  private async uploadSingle(
    client: OSS,
    key: string,
    localPath: string,
    options: UploadOptions & { total: number; startTime: number }
  ): Promise<void> {
    const stream = createReadStream(localPath)
    let transferred = 0
    stream.on('data', (chunk: string | Buffer) => {
      transferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
      options.onProgress?.(calcProgress(transferred, options.total, options.startTime))
    })

    const abortStream = (): void => {
      stream.destroy()
    }
    options.signal?.addEventListener('abort', abortStream, { once: true })

    try {
      await rejectOnAbort(client.putStream(key, stream), options.signal, '上传已取消')
      options.onProgress?.(calcProgress(options.total, options.total, options.startTime))
    } finally {
      options.signal?.removeEventListener('abort', abortStream)
    }
  }

  /**
   * 大文件分片上传（ali-oss managed multipartUpload）。
   *
   * checkpoint 由 ali-oss 维护 uploadId + 已完成分片，我们把它翻译成跨重启可
   * 持久化的回调；取消时调用 client.cancel() 让 SDK 在分片之间中断。
   */
  private async uploadMultipart(
    client: OSS,
    key: string,
    localPath: string,
    options: UploadOptions & {
      total: number
      startTime: number
      fileSize: number
      fileMtimeMs: number
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
    let uploadId = previous?.uploadId

    const checkpoint =
      previous?.uploadId && previous.parts
        ? {
            file: localPath,
            name: key,
            fileSize: options.fileSize,
            partSize,
            uploadId: previous.uploadId,
            doneParts: previous.parts.map((part) => ({
              number: part.partNumber,
              etag: part.etag
            }))
          }
        : undefined

    if (checkpoint && checkpoint.doneParts.length > 0) {
      let resumedBytes = 0
      for (const part of checkpoint.doneParts) {
        resumedBytes += bytesBeforePart(options.total, partSize, part.number + 1)
      }
      options.onProgress?.(
        calcProgress(Math.min(resumedBytes, options.total), options.total, options.startTime)
      )
      options.onCheckpoint?.({
        partSize,
        uploadId,
        parts: previous?.parts,
        fileSize: options.fileSize,
        fileMtimeMs: options.fileMtimeMs
      })
    }

    const multipartOptions = {
      partSize,
      ...(checkpoint ? { checkpoint } : {}),
      progress: (fraction: number, sdkCheckpoint: AliyunMultipartCheckpoint) => {
        if (sdkCheckpoint.uploadId) uploadId = sdkCheckpoint.uploadId
        const doneParts = sdkCheckpoint.doneParts
        let transferred = fraction * options.total
        if (doneParts) {
          transferred = 0
          for (const part of doneParts) {
            transferred += bytesBeforePart(options.total, partSize, part.number + 1)
          }
        }
        options.onProgress?.(
          calcProgress(Math.min(transferred, options.total), options.total, options.startTime)
        )
        if (uploadId) {
          options.onCheckpoint?.({
            partSize,
            uploadId,
            parts: (doneParts ?? []).map((part) => ({
              partNumber: part.number,
              etag: part.etag
            })),
            fileSize: options.fileSize,
            fileMtimeMs: options.fileMtimeMs
          })
        }
      }
    } as unknown as Parameters<OSS['multipartUpload']>[2]

    const cancelUpload = (): void => {
      client.cancel()
    }
    options.signal?.addEventListener('abort', cancelUpload, { once: true })

    try {
      await rejectOnAbort(client.multipartUpload(key, localPath, multipartOptions), options.signal)
      options.onProgress?.(calcProgress(options.total, options.total, options.startTime))
    } catch (error) {
      if (options.signal?.aborted && uploadId) {
        try {
          await client.abortMultipartUpload(key, uploadId)
        } catch {
          // 服务端会回收未完成的分片。
        }
      }
      throw error
    } finally {
      options.signal?.removeEventListener('abort', cancelUpload)
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
      const client = this.createClient(credentials, bucket)
      const result = await client.getStream(key, undefined, {})
      const startTime = Date.now()
      let transferred = 0

      const writer = createWriteStream(localPath)
      const stream = result.stream
      stream.on('data', (chunk: string | Buffer) => {
        transferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
        options.onProgress?.(calcProgress(transferred, transferred, startTime))
      })

      const abortDownload = (): void => {
        stream.destroy()
        writer.destroy()
      }
      options.signal?.addEventListener('abort', abortDownload, { once: true })

      try {
        throwIfAborted(options.signal, '下载已取消')
        await rejectOnAbort(pipeline(stream, writer), options.signal, '下载已取消')
        options.onProgress?.(calcProgress(transferred, transferred, startTime))
      } finally {
        options.signal?.removeEventListener('abort', abortDownload)
      }
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
