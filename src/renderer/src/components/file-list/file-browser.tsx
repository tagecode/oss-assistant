import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/hooks/use-i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { VirtualFileTable } from './virtual-file-table'
import { FileContextMenu } from './file-context-menu'
import { ObjectPropertiesDialog } from './object-properties-dialog'
import type { StorageObject } from '../../../../shared/types/storage'

interface FileBrowserProps {
  objects: StorageObject[]
  selectedKeys: Set<string>
  isLoading: boolean
  hasMore?: boolean
  isFetchingMore?: boolean
  onLoadMore?: () => void
  bucket: string
  prefix: string
  onToggleSelect: (key: string) => void
  onOpen: (obj: StorageObject) => void
  onDoubleClick: (obj: StorageObject) => void
  onUpload: () => void
  onUploadPaths: (paths: string[]) => void
  onDownload: () => void
  onDelete: () => void
  onCopyPath: (key: string) => void
  onRefresh: () => void
}

export function FileBrowser({
  objects,
  selectedKeys,
  isLoading,
  hasMore = false,
  isFetchingMore = false,
  onLoadMore,
  bucket,
  prefix,
  onToggleSelect,
  onOpen,
  onDoubleClick,
  onUpload,
  onUploadPaths,
  onDownload,
  onDelete,
  onCopyPath,
  onRefresh
}: FileBrowserProps): React.JSX.Element {
  const { tr } = useI18n()
  const [isDragging, setIsDragging] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    target: StorageObject | null
  } | null>(null)
  const [propertiesObject, setPropertiesObject] = useState<StorageObject | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      const paths = files.map((file) => window.api.getPathForFile(file))
      onUploadPaths(paths)
    },
    [onUploadPaths]
  )

  const openContextMenu = useCallback((e: React.MouseEvent, target: StorageObject | null) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, target })
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          'relative flex h-full flex-col',
          isDragging && 'bg-primary/5 ring-2 ring-primary ring-inset'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => openContextMenu(e, null)}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-primary/10">
            <p className="rounded-lg bg-background px-4 py-2 text-sm font-medium shadow-lg">
              {tr('dropToUpload', { bucket, prefix: prefix || tr('root') })}
            </p>
          </div>
        )}
        {objects.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
            <Upload className="size-12 opacity-40" />
            <p className="text-sm">{tr('emptyDir')}</p>
            <p className="text-xs">{tr('emptyDirHint')}</p>
          </div>
        ) : (
          <>
            <VirtualFileTable
              objects={objects}
              selectedKeys={selectedKeys}
              onToggleSelect={onToggleSelect}
              onOpen={onOpen}
              onDoubleClick={onDoubleClick}
              onContextMenu={(obj, e) => openContextMenu(e, obj)}
            />
            {hasMore && onLoadMore && (
              <div className="flex justify-center border-t py-2">
                <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isFetchingMore}>
                  {isFetchingMore ? tr('loadingMore') : tr('loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      <FileContextMenu
        menu={contextMenu}
        selectedCount={selectedKeys.size}
        onClose={() => setContextMenu(null)}
        onUpload={onUpload}
        onDownload={onDownload}
        onDelete={onDelete}
        onCopyPath={onCopyPath}
        onViewProperties={setPropertiesObject}
        onRefresh={onRefresh}
      />
      <ObjectPropertiesDialog
        object={propertiesObject}
        open={propertiesObject !== null}
        onOpenChange={(open) => {
          if (!open) setPropertiesObject(null)
        }}
      />
    </>
  )
}
