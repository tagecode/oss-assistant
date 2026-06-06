import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { testUserData } from '../../setup'
import { CredentialService } from '../../../src/main/services/credential-service'

describe('CredentialService', () => {
  it('encrypts and decrypts secrets', () => {
    const service = new CredentialService()
    const ref = service.encrypt('top-secret')
    expect(service.decrypt(ref)).toBe('top-secret')
  })

  it('stores encrypted payload instead of plaintext', () => {
    const service = new CredentialService()
    const ref = service.encrypt('vault-secret')
    const raw = readFileSync(join(testUserData, 'credentials', 'vault.json'), 'utf-8')
    expect(raw).not.toContain('vault-secret')
    expect(raw).toContain(ref)
  })

  it('rotates secret on update', () => {
    const service = new CredentialService()
    const ref = service.encrypt('old-secret')
    const nextRef = service.update(ref, 'new-secret')
    expect(nextRef).not.toBe(ref)
    expect(service.decrypt(nextRef)).toBe('new-secret')
  })
})
