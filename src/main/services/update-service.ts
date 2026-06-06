import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { SettingsService } from './settings-service'
import type { DiagnosticService } from './diagnostic-service'

export class UpdateService {
  constructor(
    private settingsService: SettingsService,
    private diagnosticService: DiagnosticService
  ) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('error', (error) => {
      this.diagnosticService.appendLog(`update error: ${error.message}`)
    })
    autoUpdater.on('update-available', (info) => {
      this.diagnosticService.appendLog(`update available: ${info.version}`)
    })
    autoUpdater.on('update-not-available', () => {
      this.diagnosticService.appendLog('update not available')
    })
  }

  checkOnStartup(): void {
    if (!app.isPackaged) return
    if (this.settingsService.get().autoCheckUpdate) {
      void this.checkForUpdates()
    }
  }

  onSettingsChanged(): void {
    if (!app.isPackaged) return
    if (this.settingsService.get().autoCheckUpdate) {
      void this.checkForUpdates()
    }
  }

  private async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.diagnosticService.appendLog(`update check failed: ${message}`)
    }
  }
}
