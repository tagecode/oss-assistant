import { Cloud, HelpCircle, ListTodo, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  onOpenSettings: () => void
  onOpenHelp: () => void
  transferCenterOpen?: boolean
  activeTaskCount?: number
  onToggleTransferCenter?: () => void
}

export function AppHeader({
  onOpenSettings,
  onOpenHelp,
  transferCenterOpen = false,
  activeTaskCount = 0,
  onToggleTransferCenter
}: AppHeaderProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-2">
        <Cloud className="size-5 text-primary" />
        <h1 className="text-sm font-semibold">{tr('appTitle')}</h1>
      </div>
      <div className="flex items-center gap-1">
        {onToggleTransferCenter && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTransferCenter}
            aria-label={transferCenterOpen ? tr('closeTaskCenter') : tr('openTaskCenter')}
            aria-pressed={transferCenterOpen}
            data-testid="header-toggle-transfer-center"
            className={cn(
              'relative',
              transferCenterOpen && 'bg-accent text-accent-foreground',
              activeTaskCount > 0 && !transferCenterOpen && 'text-primary'
            )}
          >
            <ListTodo className="size-4" />
            {activeTaskCount > 0 && (
              <Badge
                variant="default"
                className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full p-0 text-[10px]"
              >
                {activeTaskCount > 9 ? '9+' : activeTaskCount}
              </Badge>
            )}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          aria-label={tr('settings')}
          data-testid="header-settings"
        >
          <Settings className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenHelp}
          aria-label={tr('help')}
          data-testid="header-help"
        >
          <HelpCircle className="size-4" />
        </Button>
      </div>
    </header>
  )
}
