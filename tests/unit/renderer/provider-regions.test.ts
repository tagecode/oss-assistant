import { describe, expect, it } from 'vitest'
import {
  getDefaultRegion,
  getRegionLabel,
  getRegionOptions
} from '../../../src/renderer/src/lib/provider-regions'

describe('provider-regions', () => {
  it('returns provider defaults', () => {
    expect(getDefaultRegion('qiniu')).toBe('z0')
    expect(getDefaultRegion('aliyun-oss')).toBe('oss-cn-hangzhou')
    expect(getDefaultRegion('aws-s3')).toBe('us-east-1')
  })

  it('includes saved custom region when editing legacy value', () => {
    const options = getRegionOptions('qiniu', 'custom-zone')
    expect(options[0]?.value).toBe('custom-zone')
  })

  it('localizes region labels', () => {
    const option = getRegionOptions('qiniu')[0]
    expect(getRegionLabel(option, 'zh')).toContain('华东')
    expect(getRegionLabel(option, 'en')).toContain('East China')
  })
})
