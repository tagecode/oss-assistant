import { describe, expect, it } from 'vitest'
import {
  ALLOWED_IPC_CHANNELS,
  getSecureWebPreferences,
  isAllowedChannel,
  PRODUCTION_CSP
} from '../../../src/main/security'

describe('security', () => {
  it('enables contextIsolation and disables nodeIntegration', () => {
    const prefs = getSecureWebPreferences('/fake/preload.js')
    expect(prefs.contextIsolation).toBe(true)
    expect(prefs.nodeIntegration).toBe(false)
    expect(prefs.sandbox).toBe(true)
  })

  it('validates IPC channel whitelist', () => {
    expect(isAllowedChannel('accounts:list')).toBe(true)
    expect(isAllowedChannel('evil:channel')).toBe(false)
    expect(ALLOWED_IPC_CHANNELS).toContain('transfer:createUpload')
    expect(ALLOWED_IPC_CHANNELS).toContain('fs:pathsExist')
    expect(ALLOWED_IPC_CHANNELS).toContain('fs:resolveDownloadPaths')
  })

  it('defines production CSP', () => {
    expect(PRODUCTION_CSP).toContain("default-src 'self'")
    expect(PRODUCTION_CSP).not.toContain('unsafe-eval')
  })
})
