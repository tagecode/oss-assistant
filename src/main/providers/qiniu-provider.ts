import * as qiniu from 'qiniu'
import { createReadStream, createWriteStream } from 'fs'
import { stat } from 'fs/promises'
import type { BucketInfo, ListObjectsResult, StorageObject } from '../../shared/types/storage'
import { type ProviderCredentials, type StorageProvider, calcProgress } from './base-provider'
import { parseQiniuBucketAccess } from './bucket-access'
import { mapError } from './provider-errors'

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
    onProgress?: (progress: import('../../shared/types/storage').TransferProgress) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      const fileStat = await stat(localPath)
      const total = fileStat.size
      const startTime = Date.now()
      let transferred = 0

      const mac = this.getMac(credentials)
      const putPolicy = new qiniu.rs.PutPolicy({ scope: `${bucket}:${key}` })
      const uploadToken = putPolicy.uploadToken(mac)
      const formUploader = new qiniu.form_up.FormUploader(this.getConfig(credentials))
      const putExtra = new qiniu.form_up.PutExtra()

      if (signal?.aborted) throw new Error('上传已取消')

      const readStream = createReadStream(localPath)
      readStream.on('data', (chunk: string | Buffer) => {
        transferred += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk)
        onProgress?.(calcProgress(transferred, total, startTime))
      })

      const response = await formUploader.putStream(uploadToken, key, readStream, putExtra)
      if (!response.ok()) {
        throw new Error(response.data?.error || '上传失败')
      }
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
      const mac = this.getMac(credentials)
      const bucketManager = new qiniu.rs.BucketManager(mac, this.getConfig(credentials))
      const deadline = Math.floor(Date.now() / 1000) + 3600
      const domain = credentials.bucketDomain || `https://${bucket}.qiniudn.com`
      const privateUrl = bucketManager.privateDownloadUrl(domain, key, deadline)

      const response = await fetch(privateUrl, { signal })
      if (!response.ok) throw new Error(`下载失败: ${response.statusText}`)

      const total = Number(response.headers.get('content-length') || 0)
      const startTime = Date.now()
      let transferred = 0

      const writer = createWriteStream(localPath)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      while (true) {
        if (signal?.aborted) throw new Error('下载已取消')
        const { done, value } = await reader.read()
        if (done) break
        transferred += value.length
        writer.write(Buffer.from(value))
        onProgress?.(calcProgress(transferred, total || transferred, startTime))
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
