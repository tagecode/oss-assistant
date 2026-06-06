import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, beforeEach } from 'vitest'
import { testUserData } from '../../setup'
import { AccountService } from '../../../src/main/services/account-service'
import { CredentialService } from '../../../src/main/services/credential-service'

describe('AccountService', () => {
  let accountService: AccountService

  beforeEach(() => {
    const accountsPath = join(testUserData, 'accounts.json')
    const vaultPath = join(testUserData, 'credentials', 'vault.json')
    if (existsSync(accountsPath)) rmSync(accountsPath)
    if (existsSync(vaultPath)) writeFileSync(vaultPath, '{}', 'utf-8')
    accountService = new AccountService(new CredentialService())
  })

  it('creates account without persisting plaintext credentials', () => {
    const account = accountService.create({
      name: '测试账户',
      provider: 'qiniu',
      accessKeyId: 'AKID_TEST',
      secretKey: 'SECRET_PLAIN',
      region: 'z0'
    })

    expect(account.name).toBe('测试账户')
    expect(account.hasSecret).toBe(true)
    expect(account.hasAccessKey).toBe(true)

    const raw = readFileSync(join(testUserData, 'accounts.json'), 'utf-8')
    expect(raw).not.toContain('SECRET_PLAIN')
    expect(raw).not.toContain('AKID_TEST')
    expect(accountService.getSecret(account.id)).toBe('SECRET_PLAIN')
    expect(accountService.getAccessKey(account.id)).toBe('AKID_TEST')
  })

  it('updates and deletes account', () => {
    const created = accountService.create({
      name: '原始',
      provider: 'qiniu',
      accessKeyId: 'AKID1',
      secretKey: 'SECRET1'
    })

    const updated = accountService.update(created.id, {
      name: '更新后',
      secretKey: 'SECRET2',
      accessKeyId: 'AKID2'
    })
    expect(updated.name).toBe('更新后')
    expect(accountService.getSecret(created.id)).toBe('SECRET2')
    expect(accountService.getAccessKey(created.id)).toBe('AKID2')

    accountService.delete(created.id)
    expect(accountService.list()).toHaveLength(0)
  })

  it('migrates legacy plaintext access key on load', () => {
    const credentialService = new CredentialService()
    const secretRef = credentialService.encrypt('SECRET_LEGACY')
    const legacyId = 'legacy-acc-1'
    writeFileSync(
      join(testUserData, 'accounts.json'),
      JSON.stringify([
        {
          id: legacyId,
          name: '旧账户',
          provider: 'qiniu',
          accessKeyId: 'LEGACY_AKID',
          encryptedSecretRef: secretRef,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]),
      'utf-8'
    )

    const service = new AccountService(credentialService)
    const raw = readFileSync(join(testUserData, 'accounts.json'), 'utf-8')
    expect(raw).not.toContain('LEGACY_AKID')
    expect(raw).toContain('encryptedAccessKeyRef')
    expect(service.getAccessKey(legacyId)).toBe('LEGACY_AKID')
    expect(service.getSecret(legacyId)).toBe('SECRET_LEGACY')
  })

  it('resolves stored credentials for connection test on edit', () => {
    const created = accountService.create({
      name: '测试',
      provider: 'qiniu',
      accessKeyId: 'AKID_STORED',
      secretKey: 'SECRET_STORED'
    })

    const resolved = accountService.resolveForConnection(created.id, {
      name: '测试',
      provider: 'qiniu'
    })
    expect(resolved.accessKeyId).toBe('AKID_STORED')
    expect(resolved.secretKey).toBe('SECRET_STORED')
  })
})
