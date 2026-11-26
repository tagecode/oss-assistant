import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { UpdateService } from '../../../src/main/services/update-service'
import type { SettingsService } from '../../../src/main/services/settings-service'
import type { DiagnosticService } from '../../../src/main/services/diagnostic-service'

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    on: vi.fn(),
    checkForUpdates: vi.fn()
  }
}))

const packaged = app as unknown as { isPackaged: boolean }

function createService(autoCheckUpdate = true): {
  service: UpdateService
  diagnostic: { appendLog: ReturnType<typeof vi.fn> }
} {
  const diagnostic = { appendLog: vi.fn() }
  const settingsService = {
    get: vi.fn(() => ({ autoCheckUpdate }))
  }
  const service = new UpdateService(
    settingsService as unknown as SettingsService,
    diagnostic as unknown as DiagnosticService
  )
  return { service, diagnostic }
}

describe('UpdateService', () => {
  beforeEach(() => {
    packaged.isPackaged = false
    vi.mocked(autoUpdater.on).mockClear()
    vi.mocked(autoUpdater.checkForUpdates).mockReset()
    vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue(undefined)
  })

  it('configures updater defaults and subscribes to lifecycle events', () => {
    createService()

    expect(autoUpdater.autoDownload).toBe(false)
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true)
    expect(vi.mocked(autoUpdater.on).mock.calls.map(([event]) => event)).toEqual([
      'error',
      'update-available',
      'update-not-available'
    ])
  })

  it('does not check on startup when the app is unpackaged', () => {
    const { service } = createService(true)

    service.checkOnStartup()

    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('does not check when automatic updates are disabled', () => {
    packaged.isPackaged = true
    const { service } = createService(false)

    service.checkOnStartup()

    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('checks on startup when packaged and enabled', () => {
    packaged.isPackaged = true
    const { service } = createService(true)

    service.checkOnStartup()

    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce()
  })

  it('checks again when settings change and the app is packaged', () => {
    packaged.isPackaged = true
    const { service } = createService(true)

    service.onSettingsChanged()

    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce()
  })

  it('logs updater lifecycle events', () => {
    const { diagnostic } = createService()
    const listeners = new Map(
      vi.mocked(autoUpdater.on).mock.calls.map(([event, listener]) => [event, listener])
    )

    listeners.get('error')?.(new Error('offline'))
    listeners.get('update-available')?.({ version: '1.2.3' })
    listeners.get('update-not-available')?.()

    expect(diagnostic.appendLog).toHaveBeenCalledWith('update error: offline')
    expect(diagnostic.appendLog).toHaveBeenCalledWith('update available: 1.2.3')
    expect(diagnostic.appendLog).toHaveBeenCalledWith('update not available')
  })

  it('logs a failed update check instead of throwing', async () => {
    packaged.isPackaged = true
    vi.mocked(autoUpdater.checkForUpdates).mockRejectedValue(new Error('network down'))
    const { service, diagnostic } = createService(true)

    service.checkOnStartup()

    await vi.waitFor(() => {
      expect(diagnostic.appendLog).toHaveBeenCalledWith('update check failed: network down')
    })
  })
})
