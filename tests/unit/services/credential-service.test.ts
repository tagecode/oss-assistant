import { readFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { safeStorage } from 'electron'
import { testUserData } from '../../setup'
import { CredentialService } from '../../../src/main/services/credential-service'

const mockedSafeStorage = vi.mocked(safeStorage)

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

describe('CredentialService 加密降级', () => {
  beforeEach(() => {
    mockedSafeStorage.isEncryptionAvailable.mockReturnValue(true)
    mockedSafeStorage.setUsePlainTextEncryption.mockClear()
  })

  it('缺少系统加密能力且用户允许时才改用内存密钥', () => {
    mockedSafeStorage.isEncryptionAvailable.mockReturnValue(false)
    const service = new CredentialService()

    service.setFallbackEnabled(true)

    expect(mockedSafeStorage.setUsePlainTextEncryption).toHaveBeenCalledWith(true)
    expect(service.getStorageStatus()).toEqual({
      encryptionAvailable: false,
      fallbackEnabled: true
    })
  })

  it('系统加密可用时即使勾选也不降级', () => {
    const service = new CredentialService()

    service.setFallbackEnabled(true)

    expect(mockedSafeStorage.setUsePlainTextEncryption).not.toHaveBeenCalled()
    expect(service.getStorageStatus()).toEqual({
      encryptionAvailable: true,
      fallbackEnabled: true
    })
  })

  it('降级生效后状态接口仍报告真实的系统加密能力', () => {
    mockedSafeStorage.isEncryptionAvailable.mockReturnValue(false)
    const service = new CredentialService()
    service.setFallbackEnabled(true)

    // 降级生效后 Electron 会让 isEncryptionAvailable() 变成 true，
    // 这里模拟该变化：状态接口必须继续报告密钥环缺失，否则设置页
    // 会藏起降级开关并错误地宣称「由系统密钥环保护」。
    mockedSafeStorage.isEncryptionAvailable.mockReturnValue(true)

    expect(service.getStorageStatus().encryptionAvailable).toBe(false)
  })
})
