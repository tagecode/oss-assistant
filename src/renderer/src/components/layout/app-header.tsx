import { Cloud, HelpCircle, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/hooks/use-i18n'

interface AppHeaderProps {
  onOpenSettings: () => void
  onOpenHelp: () => void
}

export function AppHeader({ onOpenSettings, onOpenHelp }: AppHeaderProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-2">
        <Cloud className="size-5 text-primary" />
        <h1 className="text-sm font-semibold">{tr('appTitle')}</h1>
      </div>
      <div className="flex items-center gap-1">
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
