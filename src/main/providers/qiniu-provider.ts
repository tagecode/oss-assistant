import * as qiniu from 'qiniu'
import { randomUUID } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { BucketInfo, ListObjectsResult, StorageObject } from '../../shared/types/storage'
import {
  type ProviderCredentials,
  type StorageProvider,
  type TransferOptions,
  type UploadOptions,
  calcProgress
} from './base-provider'
import { parseQiniuBucketAccess } from './bucket-access'
import { mapError } from './provider-errors'
import {
  MULTIPART_THRESHOLD_BYTES,
  QINIU_PART_SIZE_BYTES,
  isCheckpointStale,
  rejectOnAbort,
  resolvePartSize,
  throwIfAborted
} from './multipart'

/** 七牛 SDK 暴露的断点记录器内部能力（类型定义里没有声明同步读写方法）。 */
interface QiniuResumeRecorder {
  getSync(key: string): { etags?: { partNumber: number }[]; uploadId?: string } | null
  deleteSync(key: string): void
}

const QINIU_RESUME_DIR = join(tmpdir(), 'oss-assistant-qiniu-resume')

export class QiniuProvider implements StorageProvider {
  private getMac(credentials: ProviderCredentials): qiniu.auth.digest.Mac {
    return new qiniu.auth.digest.Mac(credentials.accessKeyId, credentials.secretKey)
  }

  private getConfig(credentials: ProviderCredentials): qiniu.conf.Config {
    const config = new qiniu.conf.Config()
    const regionMap: Record<string, qiniu.conf.Zone> = {
      z0: qiniu.zone.Zone_z0,
      z1: qiniu.zone.Zone_z1,
      z2: qiniu.zone.Zone_z2,
      na0: qiniu.zone.Zone_na0,
      as0: qiniu.zone.Zone_as0
    }
    if (credentials.region && regionMap[credentials.region]) {
      config.zone = regionMap[credentials.region]
    }
    return config
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
      const mac = this.getMac(credentials)
      const bucketManager = new qiniu.rs.BucketManager(mac, this.getConfig(credentials))
      const response = await bucketManager.listBucket()
      if (!response.ok()) {
        throw new Error(response.data?.error || '列出存储桶失败')
      }
      const buckets = response.data ?? []

      return Promise.all(
        buckets.map(async (name) => {
          let permission = parseQiniuBucketAccess(undefined)
          try {
            const info = await bucketManager.getBucketInfo(name)
            if (info.ok()) {
              permission = parseQiniuBucketAccess(info.data?.private)
            }
          } catch {
            // Keep unknown when bucket info is unavailable.
          }

          return { name, permission }
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
      const mac = this.getMac(credentials)
      const bucketManager = new qiniu.rs.BucketManager(mac, this.getConfig(credentials))
      const options = { prefix, limit: 1000, delimiter: '/', marker }
      const response = await bucketManager.listPrefix(bucket, options)

      if (!response.ok()) {
        throw new Error(response.data?.error || '列出对象失败')
      }

      const respBody = response.data
      const items = respBody.items ?? []
      const commonPrefixes = respBody.commonPrefixes ?? []

      const dirObjects: StorageObject[] = commonPrefixes.map((p) => {
        const name = p.replace(prefix, '').replace(/\/$/, '')
        return { key: p, name, prefix, size: 0, isDirectory: true }
      })

      const fileObjects: StorageObject[] = items.map((item) => ({
        key: item.key,
        name: item.key.replace(prefix, ''),
        prefix,
        size: item.fsize ?? 0,
        lastModified: new Date(item.putTime / 10000).toISOString(),
        contentType: item.mimeType,
        isDirectory: false
      }))

      return {
        objects: [...dirObjects, ...fileObjects],
        prefix,
        hasMore: !!respBody.marker,
        nextMarker: respBody.marker
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

      const mac = this.getMac(credentials)
      const putPolicy = new qiniu.rs.PutPolicy({ scope: `${bucket}:${key}` })
      const uploadToken = putPolicy.uploadToken(mac)

      if (total > MULTIPART_THRESHOLD_BYTES) {
        await this.putMultipart(credentials, key, localPath, uploadToken, {
          ...options,
          total,
          startTime,
          fileSize: fileStat.size,
          fileMtimeMs: fileStat.mtimeMs
        })
      } else {
        await this.putSingle(credentials, key, localPath, uploadToken, {
          ...options,
          total,
          startTime
        })
      }
    } catch (error) {
      throw mapError(error)
    }
  }

  /** 小文件走表单上传：单请求更省往返，取消时销毁数据流让请求立即失败。 */
  private async putSingle(
    credentials: ProviderCredentials,
    key: string,
    localPath: string,
    uploadToken: string,
    options: UploadOptions & { total: number; startTime: number }
  ): Promise<void> {
    const formUploader = new qiniu.form_up.FormUploader(this.getConfig(credentials))
    const putExtra = new qiniu.form_up.PutExtra()
    const readStream = createReadStream(localPath)
    let transferred = 0

    readStream.on('data', (chunk: string | Buffer) => {
      transferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
      options.onProgress?.(calcProgress(transferred, options.total, options.startTime))
    })

    try {
      const response = await rejectOnAbort(
        formUploader.putStream(uploadToken, key, readStream, putExtra),
        options.signal,
        '上传已取消'
      )
      if (!response.ok()) {
        throw new Error(response.data?.error || '上传失败')
      }
      options.onProgress?.(calcProgress(options.total, options.total, options.startTime))
    } catch (error) {
      readStream.destroy()
      throw error
    }
  }

  /**
   * 大文件走七牛分片上传 v2 + 断点记录器。
   *
   * SDK 会在每个分片成功后把 uploadId / etag 写入本地记录，重试时自动跳过已
   * 完成的分片；取消时销毁数据流并删除记录，避免留下无法续传的残片。
   */
  private async putMultipart(
    credentials: ProviderCredentials,
    key: string,
    localPath: string,
    uploadToken: string,
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
      } as import('fs').Stats)
        ? options.checkpoint
        : undefined

    const resumeDir = previous?.resumeDir ?? QINIU_RESUME_DIR
    const resumeKey = previous?.resumeKey ?? randomUUID()
    const partSize = previous?.partSize ?? resolvePartSize(options.total, QINIU_PART_SIZE_BYTES)
    const recorder = qiniu.resume_up.createResumeRecorderSync(
      resumeDir
    ) as unknown as QiniuResumeRecorder

    if (previous?.resumeKey && previous.resumeKey !== resumeKey) {
      try {
        recorder.deleteSync(previous.resumeKey)
      } catch {
        // 旧记录清理失败不影响新上传。
      }
    }

    const completedParts = recorder.getSync(resumeKey)?.etags?.length ?? 0
    const resumedBytes = Math.min(completedParts * partSize, options.total)

    options.onCheckpoint?.({
      partSize,
      resumeDir,
      resumeKey,
      fileSize: options.fileSize,
      fileMtimeMs: options.fileMtimeMs
    })

    if (resumedBytes > 0) {
      options.onProgress?.(calcProgress(resumedBytes, options.total, options.startTime))
    }

    const putExtra = qiniu.resume_up.PutExtra.create(
      undefined,
      undefined,
      undefined,
      undefined,
      (uploadedBytes: number) => {
        options.onProgress?.(
          calcProgress(Math.min(uploadedBytes, options.total), options.total, options.startTime)
        )
      },
      partSize,
      'v2',
      undefined,
      recorder as unknown as qiniu.resume_up.ResumeRecorder,
      resumeKey
    )

    const uploader = new qiniu.resume_up.ResumeUploader(this.getConfig(credentials))
    const readStream = createReadStream(localPath)

    try {
      const response = (await rejectOnAbort(
        uploader.putStreamV2(uploadToken, key, readStream, options.total, putExtra),
        options.signal,
        '上传已取消'
      )) as { ok?: () => boolean; data?: { error?: string } }

      if (typeof response.ok === 'function' && !response.ok()) {
        throw new Error(response.data?.error || '上传失败')
      }

      options.onProgress?.(calcProgress(options.total, options.total, options.startTime))
      try {
        recorder.deleteSync(resumeKey)
      } catch {
        // 记录已由 SDK 删除或目录只读，忽略。
      }
    } catch (error) {
      readStream.destroy()
      if (options.signal?.aborted) {
        try {
          recorder.deleteSync(resumeKey)
        } catch {
          // 清理失败时残留记录会在下次同 key 上传时被复用，不影响正确性。
        }
      }
      throw error
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
      const mac = this.getMac(credentials)
      const bucketManager = new qiniu.rs.BucketManager(mac, this.getConfig(credentials))
      const deadline = Math.floor(Date.now() / 1000) + 3600
      const domain = credentials.bucketDomain || `https://${bucket}.qiniudn.com`
      const privateUrl = bucketManager.privateDownloadUrl(domain, key, deadline)

      const response = await fetch(privateUrl, { signal: options.signal })
      if (!response.ok) throw new Error(`下载失败: ${response.statusText}`)

      const total = Number(response.headers.get('content-length') || 0)
      const startTime = Date.now()
      let transferred = 0

      const writer = createWriteStream(localPath)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      while (true) {
        if (options.signal?.aborted) throw new Error('下载已取消')
        const { done, value } = await reader.read()
        if (done) break
        transferred += value.length
        writer.write(Buffer.from(value))
        options.onProgress?.(calcProgress(transferred, total || transferred, startTime))
      }

      await new Promise<void>((resolve, reject) => {
        writer.end(() => resolve())
        writer.on('error', reject)
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
    const succeeded: string[] = []
    const failed: { key: string; error: string }[] = []

    try {
      const mac = this.getMac(credentials)
      const bucketManager = new qiniu.rs.BucketManager(mac, this.getConfig(credentials))
      const deleteOps = keys.map((key) => qiniu.rs.deleteOp(bucket, key))
      const response = await bucketManager.batch(deleteOps)

      if (!response.ok()) {
        throw new Error(response.data?.[0]?.data?.error || '批量删除失败')
      }

      const results = response.data ?? []
      results.forEach((result, i) => {
        if (result.code === 200) {
          succeeded.push(keys[i])
        } else {
          failed.push({ key: keys[i], error: result.data?.error || '删除失败' })
        }
      })
    } catch (error) {
      const err = mapError(error)
      keys.forEach((key) => failed.push({ key, error: err.message }))
    }

    return { succeeded, failed }
  }
}
