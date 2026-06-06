import type { AccountInput, BucketInfo, ListObjectsResult } from '../../shared/types/storage'
import { AccountService } from './account-service'
import { QiniuProvider } from '../providers/qiniu-provider'
import { AliyunOssProvider } from '../providers/aliyun-oss-provider'
import { S3Provider } from '../providers/s3-provider'
import {
  accountToCredentials,
  type ProviderCredentials,
  type StorageProvider
} from '../providers/base-provider'

export class StorageService {
  private accountService: AccountService
  private providers: Record<string, StorageProvider>

  constructor(accountService: AccountService, providers?: Record<string, StorageProvider>) {
    this.accountService = accountService
    this.providers = providers ?? {
      qiniu: new QiniuProvider(),
      'aliyun-oss': new AliyunOssProvider(),
      'aws-s3': new S3Provider(),
      's3-compatible': new S3Provider()
    }
  }

  private getProvider(providerType: string): StorageProvider {
    const provider = this.providers[providerType]
    if (!provider) throw new Error(`不支持的服务商: ${providerType}`)
    return provider
  }

  private getCredentials(accountId: string): ProviderCredentials {
    const account = this.accountService.getById(accountId)
    if (!account) throw new Error('账户不存在')
    return accountToCredentials(
      account,
      this.accountService.getAccessKey(accountId),
      this.accountService.getSecret(accountId)
    )
  }

  private getCredentialsFromInput(
    input: Required<Pick<AccountInput, 'accessKeyId' | 'secretKey'>> &
      Omit<AccountInput, 'accessKeyId' | 'secretKey'>
  ): ProviderCredentials {
    return {
      accessKeyId: input.accessKeyId,
      secretKey: input.secretKey,
      provider: input.provider,
      region: input.region,
      endpoint: input.endpoint,
      bucketDomain: input.bucketDomain,
      pathStyleAccess: input.pathStyleAccess
    }
  }

  async testConnection(input: AccountInput): Promise<void> {
    const provider = this.getProvider(input.provider)
    if (!input.accessKeyId || !input.secretKey) {
      throw new Error('Access Key ID 和 Secret Key 不能为空')
    }
    await provider.testConnection(this.getCredentialsFromInput(input as Required<AccountInput>))
  }

  async testConnectionById(accountId: string): Promise<void> {
    const account = this.accountService.getById(accountId)
    if (!account) throw new Error('账户不存在')
    const provider = this.getProvider(account.provider)
    await provider.testConnection(this.getCredentials(accountId))
    this.accountService.updateConnectionStatus(accountId, 'connected')
  }

  async listBuckets(accountId: string): Promise<BucketInfo[]> {
    const account = this.accountService.getById(accountId)
    if (!account) throw new Error('账户不存在')
    const provider = this.getProvider(account.provider)
    return provider.listBuckets(this.getCredentials(accountId))
  }

  async listObjects(
    accountId: string,
    bucket: string,
    prefix?: string,
    marker?: string
  ): Promise<ListObjectsResult> {
    const account = this.accountService.getById(accountId)
    if (!account) throw new Error('账户不存在')
    const provider = this.getProvider(account.provider)
    return provider.listObjects(this.getCredentials(accountId), bucket, prefix, marker)
  }
}
