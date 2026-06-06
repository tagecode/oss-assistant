import { File, Folder } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/hooks/use-i18n'
import { cn, formatBytes, formatDate } from '@/lib/utils'
import type { StorageObject } from '../../../../shared/types/storage'

interface FileTableProps {
  objects: StorageObject[]
  selectedKeys: Set<string>
  isLoading: boolean
  onToggleSelect: (key: string) => void
  onOpen: (obj: StorageObject) => void
  onDoubleClick: (obj: StorageObject) => void
}

export function FileTable({
  objects,
  selectedKeys,
  isLoading,
  onToggleSelect,
  onOpen,
  onDoubleClick
}: FileTableProps): React.JSX.Element {
  const { tr, locale } = useI18n()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (objects.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
        <Folder className="size-12 opacity-40" />
        <p className="text-sm">{tr('emptyDir')}</p>
        <p className="text-xs">{tr('emptyDirHint')}</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <span className="sr-only">{tr('select')}</span>
          </TableHead>
          <TableHead>{tr('name')}</TableHead>
          <TableHead className="w-28">{tr('size')}</TableHead>
          <TableHead className="w-44">{tr('modified')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {objects.map((obj) => (
          <TableRow
            key={obj.key}
            data-state={selectedKeys.has(obj.key) ? 'selected' : undefined}
            onClick={() => onOpen(obj)}
            onDoubleClick={() => onDoubleClick(obj)}
          >
            <TableCell>
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
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {obj.isDirectory ? (
                  <Folder className="size-4 text-primary" />
                ) : (
                  <File className="size-4 text-muted-foreground" />
                )}
                <span className={cn(obj.isDirectory && 'font-medium')}>{obj.name}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {obj.isDirectory ? '-' : formatBytes(obj.size)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(obj.lastModified, locale)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
