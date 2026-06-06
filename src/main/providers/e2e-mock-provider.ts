import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import type { BucketInfo, ListObjectsResult, StorageObject } from '../../shared/types/storage'
import { type ProviderCredentials, type StorageProvider, calcProgress } from './base-provider'

const MOCK_BUCKET = 'e2e-mock-bucket'

type StoredObject = {
  size: number
  lastModified: string
  storageClass: string
  etag: string
  localCopyPath?: string
}

const objectStore = new Map<string, Map<string, StoredObject>>()

function bucketStore(bucket: string): Map<string, StoredObject> {
  let store = objectStore.get(bucket)
  if (!store) {
    store = new Map()
    objectStore.set(bucket, store)
  }
  return store
}

export class E2eMockProvider implements StorageProvider {
  async testConnection(_credentials: ProviderCredentials): Promise<void> {
    return
  }

  async listBuckets(_credentials: ProviderCredentials): Promise<BucketInfo[]> {
    return [
      {
        name: MOCK_BUCKET,
        region: 'mock-region',
        createdAt: '2026-01-01T00:00:00.000Z',
        permission: 'private'
      }
    ]
  }

  async listObjects(
    _credentials: ProviderCredentials,
    bucket: string,
    prefix = '',
    _marker?: string
  ): Promise<ListObjectsResult> {
    const store = bucketStore(bucket)
    const dirSet = new Set<string>()
    const fileObjects: StorageObject[] = []

    for (const [key, meta] of store.entries()) {
      if (!key.startsWith(prefix)) continue
      const relative = key.slice(prefix.length)
      const slashIdx = relative.indexOf('/')
      if (slashIdx >= 0) {
        dirSet.add(`${prefix}${relative.slice(0, slashIdx + 1)}`)
        continue
      }
      fileObjects.push({
        key,
        name: relative,
        prefix,
        size: meta.size,
        lastModified: meta.lastModified,
        etag: meta.etag,
        storageClass: meta.storageClass,
        isDirectory: false
      })
    }

    const dirObjects: StorageObject[] = [...dirSet].map((p) => ({
      key: p,
      name: p.replace(prefix, '').replace(/\/$/, ''),
      prefix,
      size: 0,
      isDirectory: true
    }))

    return {
      objects: [...dirObjects, ...fileObjects],
      prefix,
      hasMore: false
    }
  }

  async uploadObject(
    _credentials: ProviderCredentials,
    bucket: string,
    key: string,
    localPath: string,
    onProgress?: (progress: import('../../shared/types/storage').TransferProgress) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) throw new Error('上传已取消')
    const fileStat = statSync(localPath)
    const total = fileStat.size
    const startTime = Date.now()
    onProgress?.(calcProgress(total, total, startTime))

    const store = bucketStore(bucket)
    store.set(key, {
      size: total,
      lastModified: new Date().toISOString(),
      storageClass: 'STANDARD',
      etag: `"mock-${Date.now()}"`,
      localCopyPath: localPath
    })
  }

  async downloadObject(
    _credentials: ProviderCredentials,
    bucket: string,
    key: string,
    localPath: string,
    onProgress?: (progress: import('../../shared/types/storage').TransferProgress) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) throw new Error('下载已取消')
    const store = bucketStore(bucket)
    const obj = store.get(key)
    if (!obj) throw new Error('对象不存在')

    const dir = dirname(localPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    if (obj.localCopyPath && existsSync(obj.localCopyPath)) {
      copyFileSync(obj.localCopyPath, localPath)
    } else {
      writeFileSync(localPath, `mock content for ${key}`)
    }

    const startTime = Date.now()
    onProgress?.(calcProgress(obj.size, obj.size, startTime))
  }

  async deleteObjects(
    _credentials: ProviderCredentials,
    bucket: string,
    keys: string[]
  ): Promise<{ succeeded: string[]; failed: { key: string; error: string }[] }> {
    const store = bucketStore(bucket)
    const succeeded: string[] = []
    const failed: { key: string; error: string }[] = []

    for (const key of keys) {
      if (store.delete(key)) {
        succeeded.push(key)
      } else {
        failed.push({ key, error: '对象不存在' })
      }
    }

    return { succeeded, failed }
  }
}

export function isE2eMockMode(): boolean {
  return process.env.E2E_MOCK_CLOUD === '1' || process.argv.includes('--e2e-mock-cloud')
}

export function getE2eMockBucketName(): string {
  return MOCK_BUCKET
}
