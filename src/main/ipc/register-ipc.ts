import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { isAllowedChannel } from '../security'
import { AccountService } from '../services/account-service'
import { CredentialService } from '../services/credential-service'
import { SettingsService } from '../services/settings-service'
import { StorageService } from '../services/storage-service'
import { TransferService } from '../services/transfer-service'
import { DiagnosticService } from '../services/diagnostic-service'
import { UpdateService } from '../services/update-service'
import type { AccountInput, AppSettings } from '../../shared/types/storage'
import { pathsExist, resolveDownloadPath, uniqueDownloadPath } from '../services/path-utils'

export function registerIpcHandlers(
  accountService: AccountService,
  credentialService: CredentialService,
  settingsService: SettingsService,
  storageService: StorageService,
  transferService: TransferService,
  diagnosticService: DiagnosticService,
  updateService: UpdateService
): void {
  registerIpcHandler('app:getVersion', () => app.getVersion())
  registerIpcHandler('app:getPlatform', () => process.platform)

  const windowFromEvent = (event: IpcMainInvokeEvent): BrowserWindow | null =>
    BrowserWindow.fromWebContents(event.sender)

  registerIpcHandler('window:minimize', (event) => {
    windowFromEvent(event)?.minimize()
  })
  registerIpcHandler('window:toggleMaximize', (event) => {
    const window = windowFromEvent(event)
    if (!window) return false
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
    return window.isMaximized()
  })
  registerIpcHandler('window:close', (event) => {
    windowFromEvent(event)?.close()
  })
  registerIpcHandler(
    'window:isMaximized',
    (event) => windowFromEvent(event)?.isMaximized() ?? false
  )

  registerIpcHandler('accounts:list', () => accountService.list())
  registerIpcHandler('accounts:create', (_e, input: AccountInput) => accountService.create(input))
  registerIpcHandler('accounts:update', (_e, id: string, input: Partial<AccountInput>) =>
    accountService.update(id, input)
  )
  registerIpcHandler('accounts:delete', (_e, id: string) => accountService.delete(id))
  registerIpcHandler(
    'accounts:testConnection',
    async (_e, input: Partial<AccountInput>, accountId?: string) => {
      const resolved = accountService.resolveForConnection(accountId, input)
      await storageService.testConnection(resolved, accountId)
    }
  )

  registerIpcHandler('storage:listBuckets', (_e, accountId: string) =>
    storageService.listBuckets(accountId)
  )
  registerIpcHandler(
    'storage:listObjects',
    (_e, accountId: string, bucket: string, prefix?: string, marker?: string) =>
      storageService.listObjects(accountId, bucket, prefix, marker)
  )

  registerIpcHandler('transfer:list', () => transferService.list())
  registerIpcHandler('transfer:cancel', (_e, taskId: string) => transferService.cancel(taskId))
  registerIpcHandler('transfer:retry', (_e, taskId: string) => transferService.retry(taskId))
  registerIpcHandler('transfer:clearCompleted', () => transferService.clearCompleted())
  registerIpcHandler(
    'transfer:createUpload',
    (_e, params: { accountId: string; bucket: string; prefix: string; localPaths: string[] }) =>
      transferService.createUploadTasks(params)
  )
  registerIpcHandler(
    'transfer:createDownload',
    (
      _e,
      params: { accountId: string; bucket: string; items: { key: string; localPath: string }[] }
    ) => transferService.createDownloadTasks(params)
  )

  registerIpcHandler('fs:pathsExist', (_e, paths: string[]) => pathsExist(paths))
  registerIpcHandler('fs:resolveDownloadPaths', (_e, localDir: string, keys: string[]) =>
    keys.map((key) => ({ key, localPath: resolveDownloadPath(localDir, key) }))
  )
  registerIpcHandler('fs:uniqueDownloadPath', (_e, localDir: string, fileName: string) =>
    uniqueDownloadPath(localDir, fileName)
  )
  registerIpcHandler(
    'transfer:createDelete',
    (_e, params: { accountId: string; bucket: string; keys: string[] }) =>
      transferService.createDeleteTasks(params)
  )

  registerIpcHandler('settings:get', () => settingsService.get())
  registerIpcHandler('settings:update', (_e, partial: Partial<AppSettings>) => {
    const updated = settingsService.update(partial)
    if (partial.logRetentionDays !== undefined) {
      diagnosticService.pruneLogs(updated.logRetentionDays)
    }
    if (partial.autoCheckUpdate !== undefined) {
      updateService.onSettingsChanged()
    }
    if (partial.allowInsecureCredentialStorage !== undefined) {
      credentialService.setFallbackEnabled(updated.allowInsecureCredentialStorage)
    }
    return updated
  })
  registerIpcHandler('credentials:getStorageStatus', () => credentialService.getStorageStatus())
  registerIpcHandler('settings:selectDirectory', async (_e, defaultPath?: string) => {
    const result = await dialog.showOpenDialog({
      defaultPath,
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })
  registerIpcHandler('settings:selectFiles', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    return result.canceled ? [] : result.filePaths
  })

  registerIpcHandler('diagnostics:getInfo', () => diagnosticService.getInfo())
  registerIpcHandler('diagnostics:export', () => diagnosticService.export())
}

export function validateIpcChannel(channel: string): boolean {
  return isAllowedChannel(channel)
}

type IpcHandler = Parameters<typeof ipcMain.handle>[1]

/**
 * 所有 ipcMain.handle 注册都必须经过这里。
 *
 * 白名单只有真正拦截注册才有效；仅仅维护一份常量、却在注册时绕开校验，
 * 新增通道时就可能悄悄突破边界。
 */
export function registerIpcHandler(channel: string, listener: IpcHandler): void {
  if (!validateIpcChannel(channel)) {
    throw new Error(`IPC channel is not allowed: ${channel}`)
  }
  ipcMain.handle(channel, listener)
}
