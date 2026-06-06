import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/hooks/use-i18n'
import { formatBytes, formatDate } from '@/lib/utils'
import type { StorageObject } from '../../../../shared/types/storage'

interface ObjectPropertiesDialogProps {
  object: StorageObject | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ObjectPropertiesDialog({
  object,
  open,
  onOpenChange
}: ObjectPropertiesDialogProps): React.JSX.Element {
  const { tr, locale } = useI18n()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="object-properties-dialog">
        <DialogHeader>
          <DialogTitle>{tr('objectProperties')}</DialogTitle>
        </DialogHeader>
        {object && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{tr('name')}</dt>
            <dd className="break-all font-medium">{object.name}</dd>
            <dt className="text-muted-foreground">{tr('path')}</dt>
            <dd className="break-all">{object.key}</dd>
            <dt className="text-muted-foreground">{tr('type')}</dt>
            <dd>{object.isDirectory ? tr('folder') : tr('file')}</dd>
            {!object.isDirectory && (
              <>
                <dt className="text-muted-foreground">{tr('size')}</dt>
                <dd>{formatBytes(object.size)}</dd>
                <dt className="text-muted-foreground">{tr('modified')}</dt>
                <dd>{formatDate(object.lastModified, locale)}</dd>
                <dt className="text-muted-foreground">{tr('storageClass')}</dt>
                <dd>{object.storageClass ?? '-'}</dd>
                <dt className="text-muted-foreground">{tr('etag')}</dt>
                <dd className="break-all">{object.etag ?? '-'}</dd>
                <dt className="text-muted-foreground">{tr('contentType')}</dt>
                <dd>{object.contentType ?? '-'}</dd>
              </>
            )}
          </dl>
        )}
      </DialogContent>
    </Dialog>
  )
}
