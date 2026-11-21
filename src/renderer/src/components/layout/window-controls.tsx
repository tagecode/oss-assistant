import { useEffect, useState } from 'react'
import { Copy, Minus, Square, X } from 'lucide-react'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

const controlClass =
  'window-no-drag inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function WindowControls(): React.JSX.Element {
  const { tr } = useI18n()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    let active = true
    void window.api.windowIsMaximized().then((value) => {
      if (active) setMaximized(value)
    })
    const unsubscribe = window.api.onWindowMaximizedChange(setMaximized)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const toggleMaximize = async (): Promise<void> => {
    setMaximized(await window.api.windowToggleMaximize())
  }

  return (
    <div className="window-no-drag flex items-center gap-0.5" data-testid="window-controls">
      <button
        type="button"
        className={controlClass}
        onClick={() => void window.api.windowMinimize()}
        aria-label={tr('minimizeWindow')}
        title={tr('minimizeWindow')}
        data-testid="window-minimize"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={controlClass}
        onClick={() => void toggleMaximize()}
        aria-label={maximized ? tr('restoreWindow') : tr('maximizeWindow')}
        title={maximized ? tr('restoreWindow') : tr('maximizeWindow')}
        data-testid="window-maximize"
        data-maximized={maximized}
      >
        {maximized ? (
          <Copy className="size-3.5" aria-hidden="true" />
        ) : (
          <Square className="size-3.5" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className={cn(controlClass, 'hover:bg-destructive hover:text-destructive-foreground')}
        onClick={() => void window.api.windowClose()}
        aria-label={tr('closeWindow')}
        title={tr('closeWindow')}
        data-testid="window-close"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
