import { AlertTriangle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useI18n } from '@/hooks/use-i18n'

interface DeleteObjectsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  objectKeys: string[]
  bucket: string
  onConfirm: () => void
}

export function DeleteObjectsDialog({
  open,
  onOpenChange,
  objectKeys,
  bucket,
  onConfirm
}: DeleteObjectsDialogProps): React.JSX.Element {
  const { tr } = useI18n()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            {tr('deleteObjectsTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">
              <p>{tr('deleteObjectsConfirm', { count: objectKeys.length })}</p>
              <p className="text-xs">{tr('targetPath', { path: bucket })}</p>
              <ul className="max-h-32 overflow-auto rounded border p-2 text-xs">
                {objectKeys.slice(0, 10).map((key) => (
                  <li key={key} className="truncate">
                    {key}
                  </li>
                ))}
                {objectKeys.length > 10 && (
                  <li className="text-muted-foreground">
                    {tr('moreItems', { count: objectKeys.length - 10 })}
                  </li>
                )}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tr('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="confirm-delete-objects"
          >
            {tr('confirmDelete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
