import type { ProviderError } from '../../shared/types/storage'

export class StorageProviderError extends Error {
  code: string
  retryable: boolean

  constructor(error: ProviderError) {
    super(error.message)
    this.code = error.code
    this.retryable = error.retryable
    this.name = 'StorageProviderError'
  }

  toJSON(): ProviderError {
    return { code: this.code, message: this.message, retryable: this.retryable }
  }
}

export function mapError(error: unknown): StorageProviderError {
  if (error instanceof StorageProviderError) return error

  const message = error instanceof Error ? error.message : String(error)

  if (/network|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(message)) {
    return new StorageProviderError({
      code: 'NETWORK_ERROR',
      message: '网络连接失败，请检查网络后重试',
      retryable: true
    })
  }
  if (/401|403|InvalidAccessKeyId|SignatureDoesNotMatch|access denied/i.test(message)) {
    return new StorageProviderError({
      code: 'AUTH_ERROR',
      message: '凭证无效，请检查 Access Key 配置',
      retryable: false
    })
  }
  if (/NoSuchKey|not found|404/i.test(message)) {
    return new StorageProviderError({
      code: 'NOT_FOUND',
      message: '文件可能已被删除或移动',
      retryable: false
    })
  }
  if (
    /must be addressed using the specified endpoint|PermanentRedirect|IllegalLocationConstraint/i.test(
      message
    )
  ) {
    return new StorageProviderError({
      code: 'REGION_MISMATCH',
      message: '存储桶区域与账户配置不匹配，请检查账户区域或重新选择存储桶',
      retryable: false
    })
  }
  if (/throttl|rate limit|429/i.test(message)) {
    return new StorageProviderError({
      code: 'RATE_LIMIT',
      message: '请求过于频繁，请稍后重试',
      retryable: true
    })
  }

  return new StorageProviderError({
    code: 'UNKNOWN',
    message: message || '未知错误',
    retryable: false
  })
}
