import { ipcMain, dialog, app } from 'electron'
import { isAllowedChannel } from '../security'
import { AccountService } from '../services/account-service'
import { SettingsService } from '../services/settings-service'
import { StorageService } from '../services/storage-service'
import { TransferService } from '../services/transfer-service'
import { DiagnosticService } from '../services/diagnostic-service'
import { UpdateService } from '../services/update-service'
import type { AccountInput, AppSettings } from '../../shared/types/storage'
import { redactObject } from '../services/redaction-service'
import { pathsExist, resolveDownloadPath, uniqueDownloadPath } from '../services/path-utils'

export function registerIpcHandlers(
  accountService: AccountService,
  settingsService: SettingsService,
  storageService: StorageService,
  transferService: TransferService,
  diagnosticService: DiagnosticService,
  updateService: UpdateService
): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getPlatform', () => process.platform)

  ipcMain.handle('accounts:list', () => accountService.list())
  ipcMain.handle('accounts:create', (_e, input: AccountInput) => accountService.create(input))
  ipcMain.handle('accounts:update', (_e, id: string, input: Partial<AccountInput>) =>
    accountService.update(id, input)
  )
  ipcMain.handle('accounts:delete', (_e, id: string) => accountService.delete(id))
  ipcMain.handle(
    'accounts:testConnection',
    async (_e, input: Partial<AccountInput>, accountId?: string) => {
      const resolved = accountService.resolveForConnection(accountId, input)
      await storageService.testConnection(resolved, accountId)
    }
  )

  ipcMain.handle('storage:listBuckets', (_e, accountId: string) =>
    storageService.listBuckets(accountId)
  )
  ipcMain.handle(
    'storage:listObjects',
    (_e, accountId: string, bucket: string, prefix?: string, marker?: string) =>
      storageService.listObjects(accountId, bucket, prefix, marker)
  )

  ipcMain.handle('transfer:list', () => transferService.list())
  ipcMain.handle('transfer:cancel', (_e, taskId: string) => transferService.cancel(taskId))
  ipcMain.handle('transfer:retry', (_e, taskId: string) => transferService.retry(taskId))
  ipcMain.handle('transfer:clearCompleted', () => transferService.clearCompleted())
  ipcMain.handle(
    'transfer:createUpload',
    (_e, params: { accountId: string; bucket: string; prefix: string; localPaths: string[] }) =>
      transferService.createUploadTasks(params)
  )
  ipcMain.handle(
    'transfer:createDownload',
    (
      _e,
      params: { accountId: string; bucket: string; items: { key: string; localPath: string }[] }
    ) => transferService.createDownloadTasks(params)
  )

  ipcMain.handle('fs:pathsExist', (_e, paths: string[]) => pathsExist(paths))
  ipcMain.handle('fs:resolveDownloadPaths', (_e, localDir: string, keys: string[]) =>
    keys.map((key) => ({ key, localPath: resolveDownloadPath(localDir, key) }))
  )
  ipcMain.handle('fs:uniqueDownloadPath', (_e, localDir: string, fileName: string) =>
    uniqueDownloadPath(localDir, fileName)
  )
  ipcMain.handle(
    'transfer:createDelete',
    (_e, params: { accountId: string; bucket: string; keys: string[] }) =>
      transferService.createDeleteTasks(params)
  )

  ipcMain.handle('settings:get', () => settingsService.get())
  ipcMain.handle('settings:update', (_e, partial: Partial<AppSettings>) => {
    const updated = settingsService.update(partial)
    if (partial.logRetentionDays !== undefined) {
      diagnosticService.pruneLogs(updated.logRetentionDays)
    }
    if (partial.autoCheckUpdate !== undefined) {
      updateService.onSettingsChanged()
    }
    return updated
  })
  ipcMain.handle('settings:selectDirectory', async (_e, defaultPath?: string) => {
    const result = await dialog.showOpenDialog({
      defaultPath,
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('settings:selectFiles', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('diagnostics:getInfo', () => diagnosticService.getInfo())
  ipcMain.handle('diagnostics:export', () => diagnosticService.export())

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.on('error', (_e, error: unknown) => {
    const redacted = redactObject(error)
    diagnosticService.appendLog(JSON.stringify(redacted))
  })
}

export function validateIpcChannel(channel: string): boolean {
  return isAllowedChannel(channel)
}
