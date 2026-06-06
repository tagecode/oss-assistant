import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { File, Folder } from 'lucide-react'
import { cn, formatBytes, formatDate } from '@/lib/utils'
import { useI18n } from '@/hooks/use-i18n'
import type { StorageObject } from '../../../../shared/types/storage'

const ROW_HEIGHT = 40

interface VirtualFileTableProps {
  objects: StorageObject[]
  selectedKeys: Set<string>
  onToggleSelect: (key: string) => void
  onOpen: (obj: StorageObject) => void
  onDoubleClick: (obj: StorageObject) => void
  onContextMenu: (obj: StorageObject, e: React.MouseEvent) => void
}

export function VirtualFileTable({
  objects,
  selectedKeys,
  onToggleSelect,
  onOpen,
  onDoubleClick,
  onContextMenu
}: VirtualFileTableProps): React.JSX.Element {
  const { tr, locale } = useI18n()
  const parentRef = useRef<HTMLDivElement>(null)

  // TanStack Virtual returns unstable function refs; React Compiler skips memoization by design.
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer is the supported API
  const virtualizer = useVirtualizer({
    count: objects.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center border-b bg-muted/30 px-3 text-sm font-medium text-muted-foreground">
        <div className="w-10" />
        <div className="flex-1">{tr('name')}</div>
        <div className="w-24">{tr('size')}</div>
        <div className="w-28">{tr('storageClass')}</div>
        <div className="w-40">{tr('modified')}</div>
      </div>
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const obj = objects[virtualRow.index]
            return (
              <div
                key={obj.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`
                }}
                className={cn(
                  'flex h-10 cursor-pointer items-center border-b px-3 text-sm transition-colors hover:bg-muted/50',
                  selectedKeys.has(obj.key) && 'bg-muted'
                )}
                onClick={() => onOpen(obj)}
                onDoubleClick={() => onDoubleClick(obj)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  onContextMenu(obj, e)
                }}
              >
                <div className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(obj.key)}
                    onChange={(e) => {
                      e.stopPropagation()
                      onToggleSelect(obj.key)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-pointer"
                    aria-label={tr('selectItem', { name: obj.name })}
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {obj.isDirectory ? (
                    <Folder className="size-4 shrink-0 text-primary" />
                  ) : (
                    <File className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn('truncate', obj.isDirectory && 'font-medium')}>
                    {obj.name}
                  </span>
                </div>
                <div className="w-24 text-muted-foreground">
                  {obj.isDirectory ? '-' : formatBytes(obj.size)}
                </div>
                <div className="w-28 truncate text-muted-foreground">
                  {obj.isDirectory ? '-' : (obj.storageClass ?? '-')}
                </div>
                <div className="w-40 text-muted-foreground">
                  {formatDate(obj.lastModified, locale)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
