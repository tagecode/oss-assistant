import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { useI18n } from '@/hooks/use-i18n'
import type {
  DownloadConflictAction,
  DownloadConflictItem
} from '@/components/file-list/download-conflict-dialog'
import type { StorageObject } from '../../../shared/types/storage'

interface UseFileActionsOptions {
  objects: StorageObject[]
  onDeleteRequest: () => void
}

interface PendingDownload {
  accountId: string
  bucket: string
  localDir: string
  items: { key: string; localPath: string }[]
}

export function useFileActions({ objects, onDeleteRequest }: UseFileActionsOptions): {
  handleUpload: () => Promise<void>
  handleUploadPaths: (paths: string[]) => Promise<void>
  handleDownload: () => Promise<void>
  handleDelete: () => void
  handleCopyPath: (key: string) => Promise<void>
  downloadConflicts: DownloadConflictItem[]
  downloadConflictOpen: boolean
  setDownloadConflictOpen: (open: boolean) => void
  handleDownloadConflictConfirm: (actions: Record<string, DownloadConflictAction>) => Promise<void>
} {
  const store = useAppStore()
  const { tr } = useI18n()
  const [downloadConflicts, setDownloadConflicts] = useState<DownloadConflictItem[]>([])
  const [downloadConflictOpen, setDownloadConflictOpen] = useState(false)
  const [pendingDownload, setPendingDownload] = useState<PendingDownload | null>(null)

  const startDownload = useCallback(
    async (accountId: string, bucket: string, items: { key: string; localPath: string }[]) => {
      if (items.length === 0) return
      await window.api.createDownload({ accountId, bucket, items })
      store.setTransferCenterOpen(true)
      store.clearSelection()
      toast.success(tr('downloadTasksAdded', { count: items.length }))
    },
    [store, tr]
  )

  const uploadFiles = useCallback(
    async (localPaths: string[]) => {
      if (!store.selectedAccountId || !store.selectedBucket) {
        toast.error(tr('selectAccountBucket'))
        return
      }
      if (localPaths.length === 0) return
      await window.api.createUpload({
        accountId: store.selectedAccountId,
        bucket: store.selectedBucket,
        prefix: store.currentPrefix,
        localPaths
      })
      store.setTransferCenterOpen(true)
      toast.success(tr('uploadTasksAdded', { count: localPaths.length }))
    },
    [store, tr]
  )

  const handleUpload = useCallback(async () => {
    const files = await window.api.selectFiles()
    await uploadFiles(files)
  }, [uploadFiles])

  const handleUploadPaths = useCallback(
    async (paths: string[]) => {
      await uploadFiles(paths)
    },
    [uploadFiles]
  )

  const handleDownload = useCallback(async () => {
    if (!store.selectedAccountId || !store.selectedBucket) return
    const keys = Array.from(store.selectedKeys).filter((k) => {
      const obj = objects.find((o) => o.key === k)
      return obj && !obj.isDirectory
    })
    if (keys.length === 0) {
      toast.error(tr('selectFilesFirst'))
      return
    }
    const settings = await window.api.getSettings()
    const dir = await window.api.selectDirectory()
    const localDir = dir ?? settings.defaultDownloadPath
    if (!localDir) {
      toast.error(tr('selectFilesFirst'))
      return
    }

    const items = await window.api.resolveDownloadPaths(localDir, keys)
    const exists = await window.api.pathsExist(items.map((item) => item.localPath))
    const conflicts = items
      .filter((_, index) => exists[index])
      .map((item) => ({
        key: item.key,
        localPath: item.localPath,
        fileName: item.key.split('/').pop() ?? item.key
      }))

    if (conflicts.length > 0) {
      setPendingDownload({
        accountId: store.selectedAccountId,
        bucket: store.selectedBucket,
        localDir,
        items
      })
      setDownloadConflicts(conflicts)
      setDownloadConflictOpen(true)
      return
    }

    await startDownload(store.selectedAccountId, store.selectedBucket, items)
  }, [store, objects, startDownload, tr])

  const handleDownloadConflictConfirm = useCallback(
    async (actions: Record<string, DownloadConflictAction>) => {
      if (!pendingDownload) return
      const resolved: { key: string; localPath: string }[] = []

      for (const item of pendingDownload.items) {
        const action = actions[item.key] ?? 'rename'
        if (action === 'skip') continue
        if (action === 'overwrite') {
          resolved.push(item)
          continue
        }
        const fileName = item.key.split('/').pop() ?? item.key
        const renamedPath = await window.api.uniqueDownloadPath(pendingDownload.localDir, fileName)
        resolved.push({ key: item.key, localPath: renamedPath })
      }

      setDownloadConflictOpen(false)
      setDownloadConflicts([])
      setPendingDownload(null)
      await startDownload(pendingDownload.accountId, pendingDownload.bucket, resolved)
    },
    [pendingDownload, startDownload]
  )

  const handleDelete = useCallback(() => {
    if (store.selectedKeys.size === 0) {
      toast.error(tr('selectObjectsFirst'))
      return
    }
    onDeleteRequest()
  }, [store.selectedKeys.size, onDeleteRequest, tr])

  const handleCopyPath = useCallback(
    async (key: string) => {
      try {
        await navigator.clipboard.writeText(key)
        toast.success(tr('pathCopied'))
      } catch {
        toast.error(tr('copyFailed'))
      }
    },
    [tr]
  )

  return {
    handleUpload,
    handleUploadPaths,
    handleDownload,
    handleDelete,
    handleCopyPath,
    downloadConflicts,
    downloadConflictOpen,
    setDownloadConflictOpen,
    handleDownloadConflictConfirm
  }
}
