import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { OssApi } from './api-types'
import type { TransferTask } from '../shared/types/storage'

const api: OssApi = {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  createAccount: (input) => ipcRenderer.invoke('accounts:create', input),
  updateAccount: (id, input) => ipcRenderer.invoke('accounts:update', id, input),
  deleteAccount: (id) => ipcRenderer.invoke('accounts:delete', id),
  testConnection: (input, accountId) =>
    ipcRenderer.invoke('accounts:testConnection', input, accountId),
  listBuckets: (accountId) => ipcRenderer.invoke('storage:listBuckets', accountId),
  listObjects: (accountId, bucket, prefix, marker) =>
    ipcRenderer.invoke('storage:listObjects', accountId, bucket, prefix, marker),
  listTransfers: () => ipcRenderer.invoke('transfer:list'),
  createUpload: (params) => ipcRenderer.invoke('transfer:createUpload', params),
  createDownload: (params) => ipcRenderer.invoke('transfer:createDownload', params),
  pathsExist: (paths) => ipcRenderer.invoke('fs:pathsExist', paths),
  resolveDownloadPaths: (localDir, keys) =>
    ipcRenderer.invoke('fs:resolveDownloadPaths', localDir, keys),
  uniqueDownloadPath: (localDir, fileName) =>
    ipcRenderer.invoke('fs:uniqueDownloadPath', localDir, fileName),
  createDelete: (params) => ipcRenderer.invoke('transfer:createDelete', params),
  cancelTransfer: (taskId) => ipcRenderer.invoke('transfer:cancel', taskId),
  retryTransfer: (taskId) => ipcRenderer.invoke('transfer:retry', taskId),
  clearCompletedTransfers: () => ipcRenderer.invoke('transfer:clearCompleted'),
  onTransferUpdate: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, tasks: TransferTask[]): void => callback(tasks)
    ipcRenderer.on('transfer:onUpdate', handler)
    return () => ipcRenderer.removeListener('transfer:onUpdate', handler)
  },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (partial) => ipcRenderer.invoke('settings:update', partial),
  selectDirectory: (defaultPath) => ipcRenderer.invoke('settings:selectDirectory', defaultPath),
  selectFiles: () => ipcRenderer.invoke('settings:selectFiles'),
  getDiagnosticInfo: () => ipcRenderer.invoke('diagnostics:getInfo'),
  exportDiagnostics: () => ipcRenderer.invoke('diagnostics:export'),
  getPathForFile: (file) => webUtils.getPathForFile(file)
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-expect-error fallback
  window.api = api
}
