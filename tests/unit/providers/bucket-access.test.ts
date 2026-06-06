import { describe, expect, it } from 'vitest'
import {
  parseAliyunBucketAcl,
  parseQiniuBucketAccess,
  parseS3BucketGrants
} from '../../../src/main/providers/bucket-access'

describe('bucket access parsing', () => {
  it('maps qiniu private flag to public/private', () => {
    expect(parseQiniuBucketAccess(0)).toBe('public')
    expect(parseQiniuBucketAccess(1)).toBe('private')
    expect(parseQiniuBucketAccess(undefined)).toBe('unknown')
  })

  it('maps aliyun acl strings to public/private', () => {
    expect(parseAliyunBucketAcl('private')).toBe('private')
    expect(parseAliyunBucketAcl('public-read')).toBe('public')
    expect(parseAliyunBucketAcl('public-read-write')).toBe('public')
  })

  it('maps s3 grants to public/private', () => {
    expect(
      parseS3BucketGrants([
        {
          Grantee: { ID: 'owner' },
          Permission: 'FULL_CONTROL'
        }
      ])
    ).toBe('private')

    expect(
      parseS3BucketGrants([
        {
          Grantee: { URI: 'http://acs.amazonaws.com/groups/global/AllUsers' },
          Permission: 'READ'
        }
      ])
    ).toBe('public')
  })
})
