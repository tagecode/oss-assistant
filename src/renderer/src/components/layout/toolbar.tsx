import { Download, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/hooks/use-i18n'

interface ToolbarProps {
  selectedCount: number
  onUpload: () => void
  onDownload: () => void
  onDelete: () => void
  onRefresh: () => void
  disabled?: boolean
}

export function Toolbar({
  selectedCount,
  onUpload,
  onDownload,
  onDelete,
  onRefresh,
  disabled
}: ToolbarProps): React.JSX.Element {
  const { tr } = useI18n()

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2">
      <Button size="sm" onClick={onUpload} disabled={disabled}>
        <Upload className="size-4" />
        {tr('upload')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onDownload}
        disabled={disabled || selectedCount === 0}
      >
        <Download className="size-4" />
        {tr('download')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onDelete}
        disabled={disabled || selectedCount === 0}
        className="text-destructive hover:text-destructive"
        data-testid="toolbar-delete"
      >
        <Trash2 className="size-4" />
        {tr('delete')}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onRefresh}
        disabled={disabled}
        data-testid="toolbar-refresh"
      >
        <RefreshCw className="size-4" />
        {tr('refresh')}
      </Button>
      {selectedCount > 0 && (
        <Badge variant="secondary">{tr('selectedCount', { count: selectedCount })}</Badge>
      )}
    </div>
  )
}
