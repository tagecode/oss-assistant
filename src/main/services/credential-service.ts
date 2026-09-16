import { safeStorage } from 'electron'
import { randomUUID } from 'crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

interface CredentialStore {
  [ref: string]: string
}

export class CredentialService {
  private storePath: string
  private store: CredentialStore = {}

  constructor() {
    // 无头 Linux（CI runner）没有系统 keyring，Chromium 会退到 basic_text 后端，
    // isEncryptionAvailable() 为 false，保存账户必然抛错。Electron 为此提供了
    // 「用内存密钥代替系统密码管理器」的降级开关，但它会让凭证只剩混淆级别的保护，
    // 所以只在 E2E 显式传参时启用：生产环境宁可报错，也不静默降低安全强度。
    if (process.argv.includes('--e2e-plain-text-encryption')) {
      safeStorage.setUsePlainTextEncryption(true)
    }
    const dir = join(app.getPath('userData'), 'credentials')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.storePath = join(dir, 'vault.json')
    this.load()
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
