import { Activity } from 'lucide-react'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

interface StatusBarProps {
  activeTaskCount: number
  connectionStatus?: string
  transferCenterOpen?: boolean
  onToggleTransferCenter: () => void
}

export function StatusBar({
  activeTaskCount,
  connectionStatus,
  transferCenterOpen = false,
  onToggleTransferCenter
}: StatusBarProps): React.JSX.Element {
  const { tr } = useI18n()

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-sidebar px-4 text-xs text-muted-foreground">
      <button
        type="button"
        data-testid="open-transfer-center"
        aria-pressed={transferCenterOpen}
        onClick={onToggleTransferCenter}
        className={cn(
          'flex items-center gap-1.5 transition-colors hover:text-foreground cursor-pointer',
          (activeTaskCount > 0 || transferCenterOpen) && 'text-primary'
        )}
      >
        <Activity className="size-3.5" />
        <span>
          {activeTaskCount > 0
            ? tr('tasksActive', { count: activeTaskCount })
            : tr('noActiveTasks')}
        </span>
      </button>
      <span>{connectionStatus ?? tr('notConnected')}</span>
    </footer>
  )
}
