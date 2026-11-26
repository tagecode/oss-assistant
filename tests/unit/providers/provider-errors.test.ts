import { describe, expect, it } from 'vitest'
import { mapError, StorageProviderError } from '../../../src/main/providers/provider-errors'

describe('provider error mapping', () => {
  it('returns an existing StorageProviderError unchanged', () => {
    const original = new StorageProviderError({
      code: 'AUTH_ERROR',
      message: 'invalid credentials',
      retryable: false
    })

    expect(mapError(original)).toBe(original)
  })

  it.each([
    ['network reset', 'ECONNRESET'],
    ['connect ECONNREFUSED 127.0.0.1:443', 'ECONNREFUSED'],
    ['getaddrinfo ENOTFOUND example.com', 'ENOTFOUND'],
    ['request ETIMEDOUT', 'ETIMEDOUT']
  ])('maps network error %s to a retryable NETWORK_ERROR', (message) => {
    const error = mapError(new Error(message))

    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.retryable).toBe(true)
    expect(error.message).toContain('网络连接失败')
  })

  it.each([
    '401 Unauthorized',
    '403 Forbidden',
    'InvalidAccessKeyId',
    'SignatureDoesNotMatch',
    'Access Denied'
  ])('maps %s to a non-retryable AUTH_ERROR', (message) => {
    const error = mapError(new Error(message))

    expect(error.code).toBe('AUTH_ERROR')
    expect(error.retryable).toBe(false)
    expect(error.message).toContain('凭证无效')
  })

  it.each(['NoSuchKey', 'The specified key does not exist', '404 Not Found'])(
    'maps %s to NOT_FOUND',
    (message) => {
      const error = mapError(new Error(message))

      expect(error.code).toBe('NOT_FOUND')
      expect(error.retryable).toBe(false)
      expect(error.message).toContain('文件可能已被删除')
    }
  )

  it.each([
    'The bucket you are attempting to access must be addressed using the specified endpoint',
    'PermanentRedirect',
    'IllegalLocationConstraintException'
  ])('maps %s to REGION_MISMATCH', (message) => {
    const error = mapError(new Error(message))

    expect(error.code).toBe('REGION_MISMATCH')
    expect(error.retryable).toBe(false)
    expect(error.message).toContain('区域与账户配置不匹配')
  })

  it.each(['SlowDown', '429 Too Many Requests', 'rate limit exceeded'])(
    'maps %s to a retryable RATE_LIMIT',
    (message) => {
      const error = mapError(new Error(message))

      expect(error.code).toBe('RATE_LIMIT')
      expect(error.retryable).toBe(true)
      expect(error.message).toContain('请求过于频繁')
    }
  )

  it('falls back to UNKNOWN and preserves the original message', () => {
    const error = mapError(new Error('unexpected provider failure'))

    expect(error.code).toBe('UNKNOWN')
    expect(error.retryable).toBe(false)
    expect(error.message).toBe('unexpected provider failure')
  })

  it('converts non-Error values to a string message', () => {
    const error = mapError({ reason: 'boom' })

    expect(error.code).toBe('UNKNOWN')
    expect(error.message).toBe('[object Object]')
  })

  it('uses a readable fallback for an empty message', () => {
    const error = mapError(new Error(''))

    expect(error.code).toBe('UNKNOWN')
    expect(error.message).toBe('未知错误')
  })

  it('serializes only the public error fields', () => {
    const error = mapError(new Error('403 Forbidden'))

    expect(error.toJSON()).toEqual({
      code: 'AUTH_ERROR',
      message: '凭证无效，请检查 Access Key 配置',
      retryable: false
    })
    expect(error.name).toBe('StorageProviderError')
  })
})
