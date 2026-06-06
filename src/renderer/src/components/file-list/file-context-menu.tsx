import { useEffect, useRef } from 'react'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'
import type { StorageObject } from '../../../../shared/types/storage'

interface ContextMenuState {
  x: number
  y: number
  target: StorageObject | null
}

interface FileContextMenuProps {
  menu: ContextMenuState | null
  selectedCount: number
  onClose: () => void
  onUpload: () => void
  onDownload: () => void
  onDelete: () => void
  onCopyPath: (key: string) => void
  onViewProperties: (obj: StorageObject) => void
  onRefresh: () => void
}

export function FileContextMenu({
  menu,
  selectedCount,
  onClose,
  onUpload,
  onDownload,
  onDelete,
  onCopyPath,
  onViewProperties,
  onRefresh
}: FileContextMenuProps): React.JSX.Element | null {
  const { tr } = useI18n()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const handleClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [menu, onClose])

  if (!menu) return null

  const target = menu.target
  const canDownload = target ? !target.isDirectory : selectedCount > 0

  const itemClass =
    'flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground'

  const run = (fn: () => void): void => {
    fn()
    onClose()
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[10rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
    >
      <button type="button" className={itemClass} onClick={() => run(onUpload)} role="menuitem">
        {tr('uploadFile')}
      </button>
      <div className="my-1 h-px bg-border" />
      {target && (
        <>
          {!target.isDirectory && (
            <button
              type="button"
              className={itemClass}
              onClick={() => run(onDownload)}
              role="menuitem"
            >
              {tr('download')}
            </button>
          )}
          <button
            type="button"
            className={itemClass}
            onClick={() => run(() => onCopyPath(target.key))}
            role="menuitem"
          >
            {tr('copyPath')}
          </button>
          <button
            type="button"
            className={itemClass}
            onClick={() => run(() => onViewProperties(target))}
            role="menuitem"
            data-testid="view-properties"
          >
            {tr('viewProperties')}
          </button>
          <button
            type="button"
            className={cn(itemClass, 'text-destructive')}
            onClick={() => run(onDelete)}
            role="menuitem"
          >
            {tr('delete')}
          </button>
          <div className="my-1 h-px bg-border" />
        </>
      )}
      {!target && selectedCount > 0 && (
        <>
          <button
            type="button"
            className={itemClass}
            disabled={!canDownload}
            onClick={() => run(onDownload)}
            role="menuitem"
          >
            {tr('downloadSelected', { count: selectedCount })}
          </button>
          <button
            type="button"
            className={cn(itemClass, 'text-destructive')}
            onClick={() => run(onDelete)}
            role="menuitem"
          >
            {tr('deleteSelected', { count: selectedCount })}
          </button>
          <div className="my-1 h-px bg-border" />
        </>
      )}
      <button type="button" className={itemClass} onClick={() => run(onRefresh)} role="menuitem">
        {tr('refresh')}
      </button>
    </div>
  )
}
