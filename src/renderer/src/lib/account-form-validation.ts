import type { AccountPublic, StorageProvider } from '../../../shared/types/storage'

export type AccountFormValues = {
  name: string
  provider: StorageProvider
  accessKeyId?: string
  secretKey?: string
  region?: string
  endpoint?: string
  bucketDomain?: string
  pathStyleAccess?: boolean
}

export type AccountFormValidationMessages = {
  validationAccountName: string
  validationAccessKeyId: string
  validationSecretKey: string
  validationRegion: string
  validationBucketDomain: string
  validationEndpoint: string
}

export type AccountFormFieldError = {
  path: keyof AccountFormValues
  message: string
}

export function getEffectiveProviderField(
  value: string | undefined,
  account: AccountPublic | null | undefined,
  provider: StorageProvider,
  field: 'bucketDomain' | 'endpoint'
): string {
  const trimmed = value?.trim()
  if (trimmed) return trimmed
  if (account?.provider === provider) {
    return account[field]?.trim() ?? ''
  }
  return ''
}

export function isProviderFieldRequired(
  provider: StorageProvider,
  field: 'bucketDomain' | 'endpoint'
): boolean {
  if (field === 'bucketDomain') return provider === 'qiniu'
  return provider === 's3-compatible'
}

export function validateAccountForm(
  data: AccountFormValues,
  account: AccountPublic | null | undefined,
  messages: AccountFormValidationMessages
): AccountFormFieldError[] {
  const issues: AccountFormFieldError[] = []

  if (!data.name.trim()) {
    issues.push({ path: 'name', message: messages.validationAccountName })
  }

  if (!account) {
    if (!data.accessKeyId?.trim()) {
      issues.push({ path: 'accessKeyId', message: messages.validationAccessKeyId })
    }
    if (!data.secretKey?.trim()) {
      issues.push({ path: 'secretKey', message: messages.validationSecretKey })
    }
  }

  if (!data.region?.trim()) {
    issues.push({ path: 'region', message: messages.validationRegion })
  }

  if (data.provider === 'qiniu') {
    const bucketDomain = getEffectiveProviderField(
      data.bucketDomain,
      account,
      'qiniu',
      'bucketDomain'
    )
    if (!bucketDomain) {
      issues.push({ path: 'bucketDomain', message: messages.validationBucketDomain })
    }
  }

  if (data.provider === 's3-compatible') {
    const endpoint = getEffectiveProviderField(data.endpoint, account, 's3-compatible', 'endpoint')
    if (!endpoint) {
      issues.push({ path: 'endpoint', message: messages.validationEndpoint })
    }
  }

  return issues
}
