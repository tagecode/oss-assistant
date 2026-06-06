import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/hooks/use-i18n'

export type DownloadConflictAction = 'overwrite' | 'skip' | 'rename'

export interface DownloadConflictItem {
  key: string
  localPath: string
  fileName: string
}

interface DownloadConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: DownloadConflictItem[]
  onConfirm: (actions: Record<string, DownloadConflictAction>) => void
}

export function DownloadConflictDialog({
  open,
  onOpenChange,
  conflicts,
  onConfirm
}: DownloadConflictDialogProps): React.JSX.Element {
  const { tr } = useI18n()
  const [actions, setActions] = useState<Record<string, DownloadConflictAction>>({})
  const [applyAll, setApplyAll] = useState<DownloadConflictAction>('rename')

  const getAction = (key: string): DownloadConflictAction => actions[key] ?? 'rename'

  const handleApplyAll = (action: DownloadConflictAction): void => {
    setApplyAll(action)
    const next: Record<string, DownloadConflictAction> = {}
    conflicts.forEach((item) => {
      next[item.key] = action
    })
    setActions(next)
  }

  const handleConfirm = (): void => {
    const resolved: Record<string, DownloadConflictAction> = {}
    conflicts.forEach((item) => {
      resolved[item.key] = getAction(item.key)
    })
    onConfirm(resolved)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            {tr('downloadConflictTitle')}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{tr('downloadConflictDesc')}</p>

        <div className="flex items-center gap-2 text-sm">
          <Label>{tr('applyToAll')}</Label>
          {(['overwrite', 'skip', 'rename'] as const).map((action) => (
            <Button
              key={action}
              size="sm"
              variant={applyAll === action ? 'default' : 'outline'}
              onClick={() => handleApplyAll(action)}
            >
              {tr(action)}
            </Button>
          ))}
        </div>

        <ul className="max-h-48 space-y-2 overflow-auto rounded border p-2 text-sm">
          {conflicts.map((item) => (
            <li key={item.key} className="flex flex-col gap-1 border-b pb-2 last:border-0">
              <span className="truncate font-medium">{item.fileName}</span>
              <span className="truncate text-xs text-muted-foreground">{item.localPath}</span>
              <div className="flex gap-1">
                {(['overwrite', 'skip', 'rename'] as const).map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant={getAction(item.key) === action ? 'default' : 'outline'}
                    onClick={() =>
                      setActions((prev) => ({
                        ...prev,
                        [item.key]: action
                      }))
                    }
                  >
                    {tr(action)}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tr('cancel')}
          </Button>
          <Button onClick={handleConfirm}>{tr('startDownload')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
