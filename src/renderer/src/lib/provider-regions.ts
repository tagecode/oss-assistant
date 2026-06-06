import type { Language, StorageProvider } from '../../../shared/types/storage'

export interface ProviderRegion {
  value: string
  label: { zh: string; en: string }
}

const QINIU_REGIONS: ProviderRegion[] = [
  { value: 'z0', label: { zh: '华东-浙江 (z0)', en: 'East China - Zhejiang (z0)' } },
  { value: 'z1', label: { zh: '华北-河北 (z1)', en: 'North China - Hebei (z1)' } },
  { value: 'z2', label: { zh: '华南-广东 (z2)', en: 'South China - Guangdong (z2)' } },
  { value: 'na0', label: { zh: '北美 (na0)', en: 'North America (na0)' } },
  { value: 'as0', label: { zh: '东南亚 (as0)', en: 'Southeast Asia (as0)' } }
]

const ALIYUN_REGIONS: ProviderRegion[] = [
  { value: 'oss-cn-hangzhou', label: { zh: '华东1-杭州', en: 'China East 1 - Hangzhou' } },
  { value: 'oss-cn-shanghai', label: { zh: '华东2-上海', en: 'China East 2 - Shanghai' } },
  { value: 'oss-cn-nanjing', label: { zh: '华东5-南京', en: 'China East 5 - Nanjing' } },
  { value: 'oss-cn-qingdao', label: { zh: '华北1-青岛', en: 'China North 1 - Qingdao' } },
  { value: 'oss-cn-beijing', label: { zh: '华北2-北京', en: 'China North 2 - Beijing' } },
  { value: 'oss-cn-zhangjiakou', label: { zh: '华北3-张家口', en: 'China North 3 - Zhangjiakou' } },
  { value: 'oss-cn-huhehaote', label: { zh: '华北5-呼和浩特', en: 'China North 5 - Hohhot' } },
  { value: 'oss-cn-shenzhen', label: { zh: '华南1-深圳', en: 'China South 1 - Shenzhen' } },
  { value: 'oss-cn-guangzhou', label: { zh: '华南3-广州', en: 'China South 3 - Guangzhou' } },
  { value: 'oss-cn-chengdu', label: { zh: '西南1-成都', en: 'China Southwest 1 - Chengdu' } },
  { value: 'oss-cn-hongkong', label: { zh: '中国香港', en: 'Hong Kong' } },
  { value: 'oss-ap-southeast-1', label: { zh: '新加坡', en: 'Singapore' } },
  { value: 'oss-ap-northeast-1', label: { zh: '日本-东京', en: 'Japan - Tokyo' } },
  { value: 'oss-eu-central-1', label: { zh: '德国-法兰克福', en: 'Germany - Frankfurt' } },
  { value: 'oss-us-west-1', label: { zh: '美国-硅谷', en: 'US West - Silicon Valley' } },
  { value: 'oss-us-east-1', label: { zh: '美国-弗吉尼亚', en: 'US East - Virginia' } }
]

const AWS_REGIONS: ProviderRegion[] = [
  { value: 'us-east-1', label: { zh: '美国东部-弗吉尼亚', en: 'US East (N. Virginia)' } },
  { value: 'us-east-2', label: { zh: '美国东部-俄亥俄', en: 'US East (Ohio)' } },
  { value: 'us-west-1', label: { zh: '美国西部-加利福尼亚', en: 'US West (N. California)' } },
  { value: 'us-west-2', label: { zh: '美国西部-俄勒冈', en: 'US West (Oregon)' } },
  { value: 'eu-west-1', label: { zh: '欧洲-爱尔兰', en: 'Europe (Ireland)' } },
  { value: 'eu-west-2', label: { zh: '欧洲-伦敦', en: 'Europe (London)' } },
  { value: 'eu-central-1', label: { zh: '欧洲-法兰克福', en: 'Europe (Frankfurt)' } },
  { value: 'ap-southeast-1', label: { zh: '亚太-新加坡', en: 'Asia Pacific (Singapore)' } },
  { value: 'ap-northeast-1', label: { zh: '亚太-东京', en: 'Asia Pacific (Tokyo)' } },
  { value: 'ap-south-1', label: { zh: '亚太-孟买', en: 'Asia Pacific (Mumbai)' } },
  { value: 'sa-east-1', label: { zh: '南美-圣保罗', en: 'South America (São Paulo)' } },
  { value: 'ca-central-1', label: { zh: '加拿大-中部', en: 'Canada (Central)' } }
]

export const PROVIDER_REGIONS: Record<StorageProvider, ProviderRegion[]> = {
  qiniu: QINIU_REGIONS,
  'aliyun-oss': ALIYUN_REGIONS,
  'aws-s3': AWS_REGIONS,
  's3-compatible': AWS_REGIONS
}

export const DEFAULT_REGION: Record<StorageProvider, string> = {
  qiniu: 'z0',
  'aliyun-oss': 'oss-cn-hangzhou',
  'aws-s3': 'us-east-1',
  's3-compatible': 'us-east-1'
}

export function getDefaultRegion(provider: StorageProvider): string {
  return DEFAULT_REGION[provider]
}

export function getRegionOptions(
  provider: StorageProvider,
  currentRegion?: string
): ProviderRegion[] {
  const options = [...PROVIDER_REGIONS[provider]]
  if (currentRegion && !options.some((o) => o.value === currentRegion)) {
    options.unshift({
      value: currentRegion,
      label: { zh: currentRegion, en: currentRegion }
    })
  }
  return options
}

export function getRegionLabel(option: ProviderRegion, locale: Language): string {
  return locale === 'zh' ? option.label.zh : option.label.en
}
