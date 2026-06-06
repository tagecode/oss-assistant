import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it } from 'vitest'
import { testUserData } from '../../setup'
import { SettingsService } from '../../../src/main/services/settings-service'

describe('SettingsService', () => {
  beforeEach(() => {
    const settingsPath = join(testUserData, 'settings.json')
    if (existsSync(settingsPath)) rmSync(settingsPath)
  })

  it('uses system language by default', () => {
    const service = new SettingsService()
    expect(service.get().language).toBe('system')
  })

  it('updates partial settings', () => {
    const service = new SettingsService()
    const updated = service.update({ language: 'en', transferConcurrency: 5 })
    expect(updated.language).toBe('en')
    expect(updated.transferConcurrency).toBe(5)
  })
})
