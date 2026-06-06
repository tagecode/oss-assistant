import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useI18n } from '@/hooks/use-i18n'
import type { AppSettings, LanguageSetting, ThemeMode } from '../../../../shared/types/storage'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps): React.JSX.Element {
  const { tr } = useI18n()
  const queryClient = useQueryClient()
  const [version, setVersion] = useState('')
  const [platform, setPlatform] = useState('')

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.api.getSettings(),
    enabled: open
  })

  const mutation = useMutation({
    mutationFn: (partial: Partial<AppSettings>) => window.api.updateSettings(partial),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data)
    }
  })

  const form = settings

  useEffect(() => {
    if (open) {
      void window.api.getVersion().then(setVersion)
      void window.api.getPlatform().then(setPlatform)
    }
  }, [open])

  if (!form || isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle>{tr('settings')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{tr('appearance')}</h3>
            <div className="flex gap-2">
              {(['system', 'light', 'dark'] as ThemeMode[]).map((theme) => (
                <Button
                  key={theme}
                  size="sm"
                  variant={form.theme === theme ? 'default' : 'outline'}
                  onClick={() => mutation.mutate({ theme })}
                >
                  {theme === 'system'
                    ? tr('themeSystem')
                    : theme === 'light'
                      ? tr('themeLight')
                      : tr('themeDark')}
                </Button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{tr('language')}</h3>
            <div className="flex gap-2">
              {(['system', 'zh', 'en'] as LanguageSetting[]).map((language) => (
                <Button
                  key={language}
                  size="sm"
                  variant={form.language === language ? 'default' : 'outline'}
                  onClick={() => mutation.mutate({ language })}
                >
                  {language === 'system'
                    ? tr('languageSystem')
                    : language === 'zh'
                      ? tr('languageZh')
                      : tr('languageEn')}
                </Button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{tr('transfer')}</h3>
            <div className="flex flex-col gap-1.5">
              <Label>{tr('defaultDownloadPath')}</Label>
              <div className="flex gap-2">
                <Input
                  value={form.defaultDownloadPath}
                  onChange={(e) => mutation.mutate({ defaultDownloadPath: e.target.value })}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const dir = await window.api.selectDirectory()
                    if (dir) mutation.mutate({ defaultDownloadPath: dir })
                  }}
                >
                  {tr('browse')}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>
                {tr('transferConcurrency')} ({form.transferConcurrency})
              </Label>
              <input
                type="range"
                min={1}
                max={10}
                value={form.transferConcurrency}
                onChange={(e) => mutation.mutate({ transferConcurrency: Number(e.target.value) })}
                className="w-full cursor-pointer"
              />
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{tr('logRetention')}</h3>
            <div className="flex flex-col gap-1.5">
              <Input
                type="number"
                data-testid="settings-log-retention"
                value={form.logRetentionDays}
                onChange={(e) => mutation.mutate({ logRetentionDays: Number(e.target.value) })}
              />
            </div>
          </section>

          <Separator />

          <section className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{tr('autoCheckUpdate')}</p>
            </div>
            <Switch
              data-testid="settings-auto-update"
              checked={form.autoCheckUpdate}
              onCheckedChange={(checked) => mutation.mutate({ autoCheckUpdate: checked })}
            />
          </section>

          <Separator />

          <section className="text-xs text-muted-foreground">
            <p>
              {tr('appTitle')} v{version}
            </p>
            <p>
              {tr('platform')}：{platform}
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
