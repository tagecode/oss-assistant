import type { BucketInfo } from '../../shared/types/storage'

export type BucketAccess = NonNullable<BucketInfo['permission']>

const S3_ALL_USERS_URI = 'http://acs.amazonaws.com/groups/global/AllUsers'
const S3_PUBLIC_PERMISSIONS = new Set(['READ', 'WRITE', 'READ_ACP', 'WRITE_ACP', 'FULL_CONTROL'])

export function parseQiniuBucketAccess(privateFlag: unknown): BucketAccess {
  if (privateFlag === 0) return 'public'
  if (privateFlag === 1) return 'private'
  return 'unknown'
}

export function parseAliyunBucketAcl(acl: unknown): BucketAccess {
  const values = normalizeAclValues(acl)
  if (values.length === 0) return 'unknown'
  if (values.some((value) => value.includes('public'))) return 'public'
  if (values.some((value) => value === 'private')) return 'private'
  return 'unknown'
}

export function parseS3BucketGrants(
  grants: Array<{ Grantee?: { URI?: string; ID?: string }; Permission?: string }> | undefined
): BucketAccess {
  if (!grants?.length) return 'unknown'

  const isPublic = grants.some(
    (grant) =>
      grant.Grantee?.URI === S3_ALL_USERS_URI &&
      grant.Permission &&
      S3_PUBLIC_PERMISSIONS.has(grant.Permission)
  )

  return isPublic ? 'public' : 'private'
}

function normalizeAclValues(acl: unknown): string[] {
  if (typeof acl === 'string') {
    return [acl.toLowerCase()]
  }

  if (Array.isArray(acl)) {
    return acl.flatMap((item) => normalizeAclValues(item))
  }

  if (acl && typeof acl === 'object') {
    const record = acl as Record<string, unknown>
    return [
      ...normalizeAclValues(record.Permission),
      ...normalizeAclValues(record.permission),
      ...normalizeAclValues(record.Grant),
      ...normalizeAclValues(record.grant)
    ]
  }

  return []
}
