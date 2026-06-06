import type { OssApi } from './api-types'

declare global {
  interface Window {
    api: OssApi
  }
}

export {}
