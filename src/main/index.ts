import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createMainWindow } from './window'
import { CredentialService } from './services/credential-service'
import { AccountService } from './services/account-service'
import { SettingsService } from './services/settings-service'
import { StorageService } from './services/storage-service'
import { TransferService } from './services/transfer-service'
import { DiagnosticService } from './services/diagnostic-service'
import { UpdateService } from './services/update-service'
import { E2eMockProvider, isE2eMockMode } from './providers/e2e-mock-provider'
import { registerIpcHandlers } from './ipc/register-ipc'

let servicesInitialized = false

function initServices(): void {
  if (servicesInitialized) return
  const credentialService = new CredentialService()
  const accountService = new AccountService(credentialService)
  const settingsService = new SettingsService()
  const diagnosticService = new DiagnosticService()
  const mockProvider = isE2eMockMode() ? new E2eMockProvider() : null
  const mockProviders = mockProvider
    ? {
        qiniu: mockProvider,
        'aliyun-oss': mockProvider,
        'aws-s3': mockProvider,
        's3-compatible': mockProvider
      }
    : undefined
  const storageService = new StorageService(accountService, mockProviders)
  const transferService = new TransferService(accountService, settingsService, mockProviders)
  const updateService = new UpdateService(settingsService, diagnosticService)

  diagnosticService.pruneLogs(settingsService.get().logRetentionDays)
  updateService.checkOnStartup()

  registerIpcHandlers(
    accountService,
    settingsService,
    storageService,
    transferService,
    diagnosticService,
    updateService
  )
  servicesInitialized = true
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.oss-assistant.app')
  initServices()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
