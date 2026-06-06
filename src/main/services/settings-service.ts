import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { AppSettings } from '../../shared/types/storage'

function getDefaultSettings(): AppSettings {
  return {
    theme: 'system',
    language: 'system',
    defaultDownloadPath: app.getPath('downloads'),
    transferConcurrency: 3,
    logRetentionDays: 30,
    autoCheckUpdate: true
  }
}

export class SettingsService {
  private settingsPath: string
  private settings: AppSettings

  constructor() {
    this.settingsPath = join(app.getPath('userData'), 'settings.json')
    this.settings = this.load()
  }

  private load(): AppSettings {
    if (!existsSync(this.settingsPath)) return getDefaultSettings()
    try {
      const raw = readFileSync(this.settingsPath, 'utf-8')
      return { ...getDefaultSettings(), ...JSON.parse(raw) }
    } catch {
      return getDefaultSettings()
    }
  }

  get(): AppSettings {
    return { ...this.settings }
  }

  update(partial: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...partial }
    writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8')
    return this.get()
  }
}
