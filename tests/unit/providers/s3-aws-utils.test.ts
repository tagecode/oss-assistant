import { describe, expect, it } from 'vitest'
import {
  extractAwsBucketRegionFromError,
  normalizeAwsBucketRegion,
  regionFromS3Endpoint
} from '../../../src/main/providers/s3-aws-utils'

describe('s3-aws-utils', () => {
  it('maps legacy EU location constraint to eu-west-1', () => {
    expect(normalizeAwsBucketRegion('EU')).toBe('eu-west-1')
    expect(normalizeAwsBucketRegion(undefined)).toBe('us-east-1')
    expect(normalizeAwsBucketRegion('ap-southeast-1')).toBe('ap-southeast-1')
  })

  it('extracts region from S3 endpoint hostnames', () => {
    expect(regionFromS3Endpoint('my-bucket.s3-ap-southeast-1.amazonaws.com')).toBe('ap-southeast-1')
    expect(regionFromS3Endpoint('s3.eu-west-1.amazonaws.com')).toBe('eu-west-1')
  })

  it('extracts region from redirect error metadata', () => {
    const region = extractAwsBucketRegionFromError({
      $response: {
        headers: {
          'x-amz-bucket-region': 'ap-southeast-1'
        }
      },
      message:
        'The bucket you are attempting to access must be addressed using the specified endpoint.'
    })

    expect(region).toBe('ap-southeast-1')
  })

  it('extracts region from redirect error endpoint payload', () => {
    const region = extractAwsBucketRegionFromError({
      Endpoint: 'my-bucket.s3-ap-northeast-1.amazonaws.com',
      message: 'PermanentRedirect'
    })

    expect(region).toBe('ap-northeast-1')
  })
})
