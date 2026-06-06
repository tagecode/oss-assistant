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
import { providerLabel } from '@/lib/i18n'
import type { AccountPublic } from '../../../../shared/types/storage'

interface AccountDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountPublic | null | undefined
  onConfirm: () => void
}

export function AccountDeleteDialog({
  open,
  onOpenChange,
  account,
  onConfirm
}: AccountDeleteDialogProps): React.JSX.Element {
  const { tr, locale } = useI18n()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            {tr('deleteAccount')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">
              <p>{tr('accountDeleteConfirm', { name: account?.name ?? '' })}</p>
              {account && (
                <p className="text-xs text-muted-foreground">
                  {tr('providerInfo', {
                    provider: providerLabel(locale, account.provider)
                  })}
                  {account.region ? ` · ${tr('regionInfo', { region: account.region })}` : ''}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tr('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {tr('confirmDelete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
