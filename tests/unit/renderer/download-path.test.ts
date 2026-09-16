import { describe, expect, it } from 'vitest'
import { resolveDownloadDir } from '@/lib/download-path'

describe('resolveDownloadDir', () => {
  it('prefers the last used download directory over the configured default', () => {
    expect(
      resolveDownloadDir({
        lastDownloadPath: '/home/me/Downloads/oss',
        defaultDownloadPath: '/home/me/Downloads'
      })
    ).toBe('/home/me/Downloads/oss')
  })

  it('falls back to the configured default download path', () => {
    expect(resolveDownloadDir({ defaultDownloadPath: '/home/me/Downloads' })).toBe(
      '/home/me/Downloads'
    )
  })

  it('ignores a blank last download directory', () => {
    expect(
      resolveDownloadDir({ lastDownloadPath: '', defaultDownloadPath: '/home/me/Downloads' })
    ).toBe('/home/me/Downloads')
  })

  // 回归防护：默认下载路径是自由文本输入，用户清空后会存成空串。
  // 这里必须返回空值，调用方才能识别「没有可用目录」并改为弹出目录选择器；
  // 否则空串会一路传到 resolveDownloadPath，join('', name) 拼出相对路径写进进程工作目录。
  it('returns an empty string when the configured default was cleared', () => {
    expect(resolveDownloadDir({ defaultDownloadPath: '' })).toBe('')
  })
})
