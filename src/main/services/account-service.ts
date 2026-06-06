import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import type { AccountConfig, AccountInput, AccountPublic } from '../../shared/types/storage'
import { CredentialService } from './credential-service'

type LegacyAccountConfig = AccountConfig & { accessKeyId?: string }

export class AccountService {
  private accountsPath: string
  private accounts: AccountConfig[] = []
  private credentialService: CredentialService

  constructor(credentialService: CredentialService) {
    this.credentialService = credentialService
    this.accountsPath = join(app.getPath('userData'), 'accounts.json')
    this.load()
  }

  private load(): void {
    if (!existsSync(this.accountsPath)) {
      this.accounts = []
      return
    }
    try {
      const raw = readFileSync(this.accountsPath, 'utf-8')
      this.accounts = JSON.parse(raw) as LegacyAccountConfig[]
      this.migrateLegacyAccounts()
    } catch {
      this.accounts = []
    }
  }

  private migrateLegacyAccounts(): void {
    let changed = false
    for (const account of this.accounts as LegacyAccountConfig[]) {
      if (account.accessKeyId && !account.encryptedAccessKeyRef) {
        account.encryptedAccessKeyRef = this.credentialService.encrypt(account.accessKeyId)
        delete account.accessKeyId
        changed = true
      }
      if (account.provider === 'aws-s3' && account.endpoint) {
        delete account.endpoint
        changed = true
      }
    }
    if (changed) {
      this.persist()
    }
  }

  private persist(): void {
    writeFileSync(this.accountsPath, JSON.stringify(this.accounts, null, 2), 'utf-8')
  }

  private toPublic(account: AccountConfig): AccountPublic {
    const { encryptedSecretRef, encryptedAccessKeyRef, ...rest } = account
    return {
      ...rest,
      hasAccessKey: !!encryptedAccessKeyRef,
      hasSecret: !!encryptedSecretRef
    }
  }

  list(): AccountPublic[] {
    return this.accounts.map((a) => this.toPublic(a))
  }

  getById(id: string): AccountConfig | undefined {
    return this.accounts.find((a) => a.id === id)
  }

  getAccessKey(id: string): string {
    const account = this.getById(id)
    if (!account) throw new Error('账户不存在')
    return this.credentialService.decrypt(account.encryptedAccessKeyRef)
  }

  getSecret(id: string): string {
    const account = this.getById(id)
    if (!account) throw new Error('账户不存在')
    return this.credentialService.decrypt(account.encryptedSecretRef)
  }

  resolveForConnection(accountId: string | undefined, input: Partial<AccountInput>): AccountInput {
    if (!accountId) {
      if (!input.accessKeyId || !input.secretKey) {
        throw new Error('Access Key ID 和 Secret Key 不能为空')
      }
      return {
        name: input.name ?? '',
        provider: input.provider ?? 'qiniu',
        accessKeyId: input.accessKeyId,
        secretKey: input.secretKey,
        region: input.region,
        endpoint: input.endpoint,
        bucketDomain: input.bucketDomain,
        pathStyleAccess: input.pathStyleAccess
      }
    }

    const account = this.getById(accountId)
    if (!account) throw new Error('账户不存在')

    return {
      name: input.name ?? account.name,
      provider: input.provider ?? account.provider,
      accessKeyId: input.accessKeyId || this.getAccessKey(accountId),
      secretKey: input.secretKey || this.getSecret(accountId),
      region: input.region ?? account.region,
      endpoint: input.endpoint ?? account.endpoint,
      bucketDomain: input.bucketDomain ?? account.bucketDomain,
      pathStyleAccess: input.pathStyleAccess ?? account.pathStyleAccess
    }
  }

  create(input: AccountInput): AccountPublic {
    if (!input.accessKeyId || !input.secretKey) {
      throw new Error('Access Key ID 和 Secret Key 不能为空')
    }
    const now = new Date().toISOString()
    const encryptedAccessKeyRef = this.credentialService.encrypt(input.accessKeyId)
    const encryptedSecretRef = this.credentialService.encrypt(input.secretKey)
    const account: AccountConfig = {
      id: randomUUID(),
      name: input.name,
      provider: input.provider,
      encryptedAccessKeyRef,
      encryptedSecretRef,
      region: input.region,
      endpoint: input.provider === 'aws-s3' ? undefined : input.endpoint,
      bucketDomain: input.bucketDomain,
      pathStyleAccess: input.pathStyleAccess,
      createdAt: now,
      updatedAt: now,
      lastConnectionStatus: 'unknown'
    }
    this.accounts.push(account)
    this.persist()
    return this.toPublic(account)
  }

  update(id: string, input: Partial<AccountInput>): AccountPublic {
    const index = this.accounts.findIndex((a) => a.id === id)
    if (index === -1) throw new Error('账户不存在')
    const existing = this.accounts[index]
    const now = new Date().toISOString()

    let encryptedAccessKeyRef = existing.encryptedAccessKeyRef
    if (input.accessKeyId) {
      encryptedAccessKeyRef = this.credentialService.update(
        existing.encryptedAccessKeyRef,
        input.accessKeyId
      )
    }

    let encryptedSecretRef = existing.encryptedSecretRef
    if (input.secretKey) {
      encryptedSecretRef = this.credentialService.update(
        existing.encryptedSecretRef,
        input.secretKey
      )
    }

    const provider = input.provider ?? existing.provider
    this.accounts[index] = {
      ...existing,
      name: input.name ?? existing.name,
      provider,
      encryptedAccessKeyRef,
      encryptedSecretRef,
      region: input.region ?? existing.region,
      endpoint: provider === 'aws-s3' ? undefined : (input.endpoint ?? existing.endpoint),
      bucketDomain: input.bucketDomain ?? existing.bucketDomain,
      pathStyleAccess: input.pathStyleAccess ?? existing.pathStyleAccess,
      updatedAt: now
    }
    this.persist()
    return this.toPublic(this.accounts[index])
  }

  delete(id: string): void {
    const account = this.getById(id)
    if (!account) throw new Error('账户不存在')
    this.credentialService.delete(account.encryptedAccessKeyRef)
    this.credentialService.delete(account.encryptedSecretRef)
    this.accounts = this.accounts.filter((a) => a.id !== id)
    this.persist()
  }

  updateConnectionStatus(id: string, status: 'connected' | 'failed'): void {
    const account = this.getById(id)
    if (!account) return
    account.lastConnectionStatus = status
    account.lastConnectedAt = new Date().toISOString()
    account.updatedAt = new Date().toISOString()
    this.persist()
  }
}
