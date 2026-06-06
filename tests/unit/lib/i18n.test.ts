import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveLocale, t } from '../../../src/renderer/src/lib/i18n'

describe('i18n', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves zh and en explicitly', () => {
    expect(resolveLocale('zh')).toBe('zh')
    expect(resolveLocale('en')).toBe('en')
  })

  it('follows system zh locale', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    expect(resolveLocale('system')).toBe('zh')
  })

  it('defaults to en when system locale is unsupported', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    expect(resolveLocale('system')).toBe('en')
  })

  it('translates with variables', () => {
    expect(t('en', 'uploadTasksAdded', { count: 3 })).toBe('Added 3 upload task(s)')
    expect(t('zh', 'uploadTasksAdded', { count: 3 })).toBe('已添加 3 个上传任务')
  })
})
