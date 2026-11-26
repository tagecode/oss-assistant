import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { useFileActions } from '@/hooks/use-file-actions'
import { useAppStore } from '@/stores/app-store'
import type { AppSettings, StorageObject } from '../../../../src/shared/types/storage'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}))

vi.mock('@/hooks/use-i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key })
}))

const file: StorageObject = {
  key: 'a.txt',
  name: 'a.txt',
  prefix: '',
  size: 12,
  isDirectory: false
}

const folder: StorageObject = {
  key: 'folder/',
  name: 'folder',
  prefix: '',
  size: 0,
  isDirectory: true
}

const settings: AppSettings = {
  theme: 'system',
  language: 'zh',
  defaultDownloadPath: '/tmp/downloads',
  transferConcurrency: 3,
  logRetentionDays: 30,
  autoCheckUpdate: true,
  allowInsecureCredentialStorage: false
}

function renderActions(
  onDeleteRequest = vi.fn()
): ReturnType<typeof renderHook<ReturnType<typeof useFileActions>, unknown>> {
  return renderHook(() => useFileActions({ objects: [file, folder], onDeleteRequest }))
}

describe('useFileActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({
      selectedAccountId: 'acc-1',
      selectedBucket: 'bucket',
      currentPrefix: 'folder/',
      selectedKeys: new Set([file.key]),
      transferCenterOpen: false
    })
    vi.mocked(window.api.getSettings).mockResolvedValue(settings)
    vi.mocked(window.api.resolveDownloadPaths).mockResolvedValue([
      { key: file.key, localPath: '/tmp/downloads/a.txt' }
    ])
    vi.mocked(window.api.pathsExist).mockResolvedValue([false])
    vi.mocked(window.api.createDownload).mockResolvedValue([])
    vi.mocked(window.api.createUpload).mockResolvedValue([])
    vi.mocked(window.api.selectDirectory).mockResolvedValue('/tmp/other')
    vi.mocked(window.api.selectFiles).mockResolvedValue([])
  })

  it('adds selected files to the download queue', async () => {
    const { result } = renderActions()

    await act(async () => {
      await result.current.handleDownload()
    })

    expect(window.api.createDownload).toHaveBeenCalledWith({
      accountId: 'acc-1',
      bucket: 'bucket',
      items: [{ key: 'a.txt', localPath: '/tmp/downloads/a.txt' }]
    })
    expect(useAppStore.getState().transferCenterOpen).toBe(true)
    expect(useAppStore.getState().selectedKeys.size).toBe(0)
  })

  it('rejects a download when only a folder is selected', async () => {
    useAppStore.setState({ selectedKeys: new Set([folder.key]) })
    const { result } = renderActions()

    await act(async () => {
      await result.current.handleDownload()
    })

    expect(toast.error).toHaveBeenCalledWith('selectFilesFirst')
    expect(window.api.createDownload).not.toHaveBeenCalled()
  })

  it('asks for a directory when the saved path is empty', async () => {
    vi.mocked(window.api.getSettings).mockResolvedValue({
      ...settings,
      defaultDownloadPath: '',
      lastDownloadPath: ''
    })
    const { result } = renderActions()

    await act(async () => {
      await result.current.handleDownload()
    })

    expect(window.api.selectDirectory).toHaveBeenCalledWith(undefined)
    expect(window.api.updateSettings).toHaveBeenCalledWith({ lastDownloadPath: '/tmp/other' })
    expect(window.api.resolveDownloadPaths).toHaveBeenCalledWith('/tmp/other', ['a.txt'])
  })

  it('opens the conflict dialog instead of downloading when a path exists', async () => {
    vi.mocked(window.api.pathsExist).mockResolvedValue([true])
    const { result } = renderActions()

    await act(async () => {
      await result.current.handleDownload()
    })

    expect(result.current.downloadConflictOpen).toBe(true)
    expect(result.current.downloadConflicts).toEqual([
      { key: 'a.txt', localPath: '/tmp/downloads/a.txt', fileName: 'a.txt' }
    ])
    expect(window.api.createDownload).not.toHaveBeenCalled()
  })

  it('downloads only non-skipped conflicts and renames the rest', async () => {
    vi.mocked(window.api.pathsExist).mockResolvedValue([true])
    vi.mocked(window.api.uniqueDownloadPath).mockResolvedValue('/tmp/downloads/a (1).txt')
    const { result } = renderActions()

    await act(async () => {
      await result.current.handleDownload()
    })
    await act(async () => {
      await result.current.handleDownloadConflictConfirm({ 'a.txt': 'rename' })
    })

    expect(window.api.uniqueDownloadPath).toHaveBeenCalledWith('/tmp/downloads', 'a.txt')
    expect(window.api.createDownload).toHaveBeenCalledWith({
      accountId: 'acc-1',
      bucket: 'bucket',
      items: [{ key: 'a.txt', localPath: '/tmp/downloads/a (1).txt' }]
    })
    expect(result.current.downloadConflictOpen).toBe(false)
  })

  it('does not create a download when every conflict is skipped', async () => {
    vi.mocked(window.api.pathsExist).mockResolvedValue([true])
    const { result } = renderActions()

    await act(async () => {
      await result.current.handleDownload()
    })
    await act(async () => {
      await result.current.handleDownloadConflictConfirm({ 'a.txt': 'skip' })
    })

    expect(window.api.createDownload).not.toHaveBeenCalled()
    expect(result.current.downloadConflictOpen).toBe(false)
  })

  it('uploads selected paths with the current prefix', async () => {
    const { result } = renderActions()

    await act(async () => {
      await result.current.handleUploadPaths(['/tmp/upload.txt'])
    })

    expect(window.api.createUpload).toHaveBeenCalledWith({
      accountId: 'acc-1',
      bucket: 'bucket',
      prefix: 'folder/',
      localPaths: ['/tmp/upload.txt']
    })
    expect(useAppStore.getState().transferCenterOpen).toBe(true)
  })

  it('rejects an upload without a selected account', async () => {
    useAppStore.setState({ selectedAccountId: null, selectedBucket: null })
    const { result } = renderActions()

    await act(async () => {
      await result.current.handleUploadPaths(['/tmp/upload.txt'])
    })

    expect(toast.error).toHaveBeenCalledWith('selectAccountBucket')
    expect(window.api.createUpload).not.toHaveBeenCalled()
  })

  it('delegates deletion and rejects an empty selection', () => {
    const onDeleteRequest = vi.fn()
    const { result } = renderActions(onDeleteRequest)

    result.current.handleDelete()
    expect(onDeleteRequest).toHaveBeenCalledOnce()

    act(() => {
      useAppStore.setState({ selectedKeys: new Set() })
    })
    act(() => {
      result.current.handleDelete()
    })
    expect(toast.error).toHaveBeenCalledWith('selectObjectsFirst')
  })

  it('reports copy success and failure', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
    const { result } = renderActions()

    await act(async () => {
      await result.current.handleCopyPath('folder/a.txt')
    })
    expect(writeText).toHaveBeenCalledWith('folder/a.txt')
    expect(toast.success).toHaveBeenCalledWith('pathCopied')

    writeText.mockRejectedValueOnce(new Error('denied'))
    await act(async () => {
      await result.current.handleCopyPath('folder/a.txt')
    })
    expect(toast.error).toHaveBeenCalledWith('copyFailed')
  })
})
