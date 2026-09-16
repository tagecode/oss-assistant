import { safeStorage } from 'electron'
import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { CredentialStorageStatus } from '../../shared/types/storage'

interface CredentialStore {
  [ref: string]: string
}

export class CredentialService {
  private storePath: string
  private store: CredentialStore = {}
  private fallbackEnabled = false
  /**
   * 构造时（即任何降级生效前）记录的系统加密能力。
   *
   * 不能改成实时查询：一旦启用了降级，`isEncryptionAvailable()` 会因为内存密钥已就位
   * 而返回 true，设置页就会误以为密钥环可用，进而藏起开关并显示「由系统密钥环保护」
   * 这种与事实相反的结论。
   */
  private readonly systemEncryptionAvailable: boolean

  constructor() {
    this.systemEncryptionAvailable = safeStorage.isEncryptionAvailable()
    const dir = join(app.getPath('userData'), 'credentials')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.storePath = join(dir, 'vault.json')
    this.load()
  }

  /**
   * 设置「缺少系统密钥环时是否降级为内存密钥」。设置页改动后随时可再次调用。
   *
   * 只有确实没有可用的系统加密能力时才降级：如果系统本来就能加密，绝不能因为用户
   * 勾了这个选项反而把可用的密钥环换成内存密钥，那等于主动削弱保护。
   * `setUsePlainTextEncryption` 在 Windows / macOS 上是空操作，无需再加平台分支。
   */
  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled
    if (enabled && !this.systemEncryptionAvailable) {
      safeStorage.setUsePlainTextEncryption(true)
    }
    // 关闭时不回退：本次运行内可能已用内存密钥写入过凭证，当场换回系统密钥会让它们
    // 立刻解不开。下次启动按持久化的设置决定，届时不再降级。
  }

  getStorageStatus(): CredentialStorageStatus {
    return {
      encryptionAvailable: this.systemEncryptionAvailable,
      fallbackEnabled: this.fallbackEnabled
    }
  }

  private load(): void {
    if (!existsSync(this.storePath)) {
      this.store = {}
      return
    }
    try {
      const raw = readFileSync(this.storePath, 'utf-8')
      this.store = JSON.parse(raw) as CredentialStore
    } catch {
      this.store = {}
    }
  }

  private persist(): void {
    writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8')
  }

  encrypt(secret: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('系统加密能力不可用，无法安全保存凭证')
    }
    const ref = randomUUID()
    const encrypted = safeStorage.encryptString(secret).toString('base64')
    this.store[ref] = encrypted
    this.persist()
    return ref
  }

  decrypt(ref: string): string {
    const encrypted = this.store[ref]
    if (!encrypted) throw new Error('凭证引用不存在')
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('系统加密能力不可用')
    }
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  }

  delete(ref: string): void {
    delete this.store[ref]
    this.persist()
  }

  update(ref: string, secret: string): string {
    this.delete(ref)
    return this.encrypt(secret)
  }
}
