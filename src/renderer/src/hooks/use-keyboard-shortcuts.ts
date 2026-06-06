import { useEffect } from 'react'

interface ShortcutHandlers {
  onUpload: () => void
  onDownload: () => void
  onDelete: () => void
  onRefresh: () => void
  enabled?: boolean
}

export function useKeyboardShortcuts({
  onUpload,
  onDownload,
  onDelete,
  onRefresh,
  enabled = true
}: ShortcutHandlers): void {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'u') {
        e.preventDefault()
        onUpload()
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        onDownload()
        return
      }
      if (e.key === 'Delete') {
        e.preventDefault()
        onDelete()
        return
      }
      if (e.key === 'F5') {
        e.preventDefault()
        onRefresh()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onUpload, onDownload, onDelete, onRefresh, enabled])
}
