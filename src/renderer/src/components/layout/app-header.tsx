import { useEffect, useState } from 'react'
import { Cloud, HelpCircle, ListTodo, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WindowControls } from '@/components/layout/window-controls'
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
  const [platform, setPlatform] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void window.api.getPlatform().then((value) => {
      if (active) setPlatform(value)
    })
    return () => {
      active = false
    }
  }, [])

  // Windows/Linux 会把拖拽区当作非客户区（HTCAPTION），双击由系统/窗口管理器
  // 直接最大化；macOS 的无边框窗口没有这个原生行为，这里补上。只在 macOS 处理，
  // 避免其他平台上系统和脚本各切换一次。
  const handleTitleBarDoubleClick = (event: React.MouseEvent<HTMLElement>): void => {
    if (platform !== 'darwin') return
    if ((event.target as HTMLElement).closest('button, [data-testid="window-controls"]')) return
    void window.api.windowToggleMaximize()
  }

  return (
    <header
      className="window-drag flex h-12 shrink-0 select-none items-center justify-between border-b border-border pl-4 pr-2"
      data-testid="window-titlebar"
      onDoubleClick={handleTitleBarDoubleClick}
    >
      <div className="window-drag flex items-center gap-2">
        <Cloud className="size-5 text-primary" aria-hidden="true" />
        <h1 className="text-sm font-semibold">{tr('appTitle')}</h1>
      </div>
      <div className="window-no-drag flex items-center gap-1">
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
        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <WindowControls />
      </div>
    </header>
  )
}
