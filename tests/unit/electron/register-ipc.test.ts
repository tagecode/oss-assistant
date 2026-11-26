import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ipcMain } from 'electron'
import { isAllowedChannel } from '../../../src/main/security'
import { registerIpcHandler, registerIpcHandlers } from '../../../src/main/ipc/register-ipc'

describe('IPC registration whitelist', () => {
  beforeEach(() => {
    vi.mocked(ipcMain.handle).mockClear()
  })

  it('registers an allowed channel', () => {
    const listener = vi.fn()
    registerIpcHandler('app:getVersion', listener)

    expect(ipcMain.handle).toHaveBeenCalledWith('app:getVersion', listener)
  })

  it('rejects and does not register an unknown channel', () => {
    expect(() => registerIpcHandler('evil:channel', vi.fn())).toThrow(
      'IPC channel is not allowed: evil:channel'
    )
    expect(ipcMain.handle).not.toHaveBeenCalled()
  })

  it('registers only channels present in the shared whitelist', () => {
    const service = {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      resolveForConnection: vi.fn(),
      testConnection: vi.fn(),
      listBuckets: vi.fn(),
      listObjects: vi.fn(),
      createUploadTasks: vi.fn(),
      createDownloadTasks: vi.fn(),
      createDeleteTasks: vi.fn(),
      cancel: vi.fn(),
      retry: vi.fn(),
      clearCompleted: vi.fn(),
      get: vi.fn(),
      pruneLogs: vi.fn(),
      onSettingsChanged: vi.fn(),
      setFallbackEnabled: vi.fn(),
      getStorageStatus: vi.fn(),
      getInfo: vi.fn(),
      export: vi.fn()
    }

    registerIpcHandlers(
      service as never,
      service as never,
      service as never,
      service as never,
      service as never,
      service as never,
      service as never
    )

    const channels = vi.mocked(ipcMain.handle).mock.calls.map(([channel]) => channel)
    expect(channels.length).toBeGreaterThan(20)
    expect(channels).toContain('transfer:createUpload')
    expect(channels.every((channel) => isAllowedChannel(channel))).toBe(true)
  })
})
