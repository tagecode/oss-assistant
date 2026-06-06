import { describe, expect, it } from 'vitest'
import { redactObject, redactSensitiveText } from '../../../src/main/services/redaction-service'

describe('redaction-service', () => {
  it('redacts secret key patterns in text', () => {
    const input = 'secretKey=abcdefghijklmnop'
    const result = redactSensitiveText(input)
    expect(result).not.toContain('abcdefghijklmnop')
    expect(result).toContain('***')
  })

  it('redacts AKIA access key ids', () => {
    const input = 'AKIAIOSFODNN7EXAMPLE'
    const result = redactSensitiveText(input)
    expect(result).toContain('***')
  })

  it('redacts secret fields in objects', () => {
    const input = {
      name: 'test',
      secretKey: 'super-secret-value',
      nested: { authorization: 'Bearer token123456' }
    }
    const result = redactObject(input)
    expect(result.secretKey).toBe('***REDACTED***')
    expect(result.nested.authorization).toBe('***REDACTED***')
    expect(result.name).toBe('test')
  })

  it('does not leak secrets in diagnostic-like payload', () => {
    const payload = {
      error: 'Auth failed secret=MySecretKey12345',
      accessKeySecret: 'should-not-appear'
    }
    const redacted = redactObject(payload)
    const serialized = JSON.stringify(redacted)
    expect(serialized).not.toContain('MySecretKey12345')
    expect(serialized).not.toContain('should-not-appear')
  })
})
