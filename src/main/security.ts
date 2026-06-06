import type { WebPreferences } from 'electron'

export const ALLOWED_IPC_CHANNELS = [
  'app:getVersion',
  'app:getPlatform',
  'accounts:list',
  'accounts:create',
  'accounts:update',
  'accounts:delete',
  'accounts:testConnection',
  'storage:listBuckets',
  'storage:listObjects',
  'transfer:list',
  'transfer:createUpload',
  'transfer:createDownload',
  'transfer:createDelete',
  'transfer:cancel',
  'transfer:retry',
  'transfer:clearCompleted',
  'transfer:onUpdate',
  'settings:get',
  'settings:update',
  'settings:selectDirectory',
  'settings:selectFiles',
  'fs:pathsExist',
  'fs:resolveDownloadPaths',
  'fs:uniqueDownloadPath',
  'diagnostics:export',
  'diagnostics:getInfo'
] as const

export type IpcChannel = (typeof ALLOWED_IPC_CHANNELS)[number]

export function isAllowedChannel(channel: string): channel is IpcChannel {
  return (ALLOWED_IPC_CHANNELS as readonly string[]).includes(channel)
}

export function getSecureWebPreferences(preloadPath: string): WebPreferences {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false
  }
}

export const PRODUCTION_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:; font-src 'self' data:"
