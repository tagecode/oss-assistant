import { describe, expect, it } from 'vitest'
import {
  getEffectiveProviderField,
  isProviderFieldRequired,
  validateAccountForm
} from '@/lib/account-form-validation'
import type { AccountPublic } from '../../../src/shared/types/storage'

const messages = {
  validationAccountName: '请输入账户名称',
  validationAccessKeyId: '请输入 Access Key ID',
  validationSecretKey: '请输入 Secret Key',
  validationRegion: '请选择区域',
  validationBucketDomain: '请输入 Bucket 域名（下载文件需要）',
  validationEndpoint: '请输入 Endpoint'
}

const qiniuAccount: AccountPublic = {
  id: 'acc-1',
  name: '七牛云生产',
  provider: 'qiniu',
  region: 'z0',
  bucketDomain: 'https://cdn.example.com',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
  hasAccessKey: true,
  hasSecret: true
}

describe('account-form-validation', () => {
  it('requires bucket domain for qiniu on new account', () => {
    const issues = validateAccountForm(
      {
        name: '测试',
        provider: 'qiniu',
        accessKeyId: 'AK',
        secretKey: 'SK',
        region: 'z0'
      },
      null,
      messages
    )

    expect(issues).toContainEqual({
      path: 'bucketDomain',
      message: messages.validationBucketDomain
    })
  })

  it('allows edit qiniu when bucket domain is unchanged on account', () => {
    const issues = validateAccountForm(
      {
        name: '七牛云生产',
        provider: 'qiniu',
        region: 'z0'
      },
      qiniuAccount,
      messages
    )

    expect(issues.find((issue) => issue.path === 'bucketDomain')).toBeUndefined()
  })

  it('requires endpoint for s3-compatible on new account', () => {
    const issues = validateAccountForm(
      {
        name: 'MinIO',
        provider: 's3-compatible',
        accessKeyId: 'AK',
        secretKey: 'SK',
        region: 'us-east-1'
      },
      null,
      messages
    )

    expect(issues).toContainEqual({
      path: 'endpoint',
      message: messages.validationEndpoint
    })
  })

  it('does not require endpoint for aws-s3', () => {
    const issues = validateAccountForm(
      {
        name: 'AWS',
        provider: 'aws-s3',
        accessKeyId: 'AK',
        secretKey: 'SK',
        region: 'us-east-1'
      },
      null,
      messages
    )

    expect(issues.find((issue) => issue.path === 'endpoint')).toBeUndefined()
  })

  it('resolves effective provider field from existing account', () => {
    expect(getEffectiveProviderField(undefined, qiniuAccount, 'qiniu', 'bucketDomain')).toBe(
      'https://cdn.example.com'
    )
    expect(getEffectiveProviderField('', qiniuAccount, 'aliyun-oss', 'bucketDomain')).toBe('')
  })

  it('marks provider-specific required fields', () => {
    expect(isProviderFieldRequired('qiniu', 'bucketDomain')).toBe(true)
    expect(isProviderFieldRequired('aws-s3', 'endpoint')).toBe(false)
    expect(isProviderFieldRequired('s3-compatible', 'endpoint')).toBe(true)
  })
})
