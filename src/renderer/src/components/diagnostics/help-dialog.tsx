import { useMemo, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useI18n } from '@/hooks/use-i18n'
import { providerLabel, type MessageKey } from '@/lib/i18n'
import { toast } from 'sonner'

interface HelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps): React.JSX.Element {
  const { tr, locale } = useI18n()
  const [exporting, setExporting] = useState(false)

  const errorGuides = useMemo(
    () =>
      [
        {
          code: 'NETWORK_ERROR',
          titleKey: 'errorNetworkTitle' as MessageKey,
          descKey: 'errorNetworkDesc' as MessageKey
        },
        {
          code: 'AUTH_ERROR',
          titleKey: 'errorAuthTitle' as MessageKey,
          descKey: 'errorAuthDesc' as MessageKey
        },
        {
          code: 'NOT_FOUND',
          titleKey: 'errorNotFoundTitle' as MessageKey,
          descKey: 'errorNotFoundDesc' as MessageKey
        },
        {
          code: 'RATE_LIMIT',
          titleKey: 'errorRateLimitTitle' as MessageKey,
          descKey: 'errorRateLimitDesc' as MessageKey
        }
      ] as const,
    []
  )

  const providerGuides = useMemo(
    () =>
      [
        { provider: 'qiniu' as const, fieldsKey: 'guideQiniuFields' as MessageKey },
        { provider: 'aliyun-oss' as const, fieldsKey: 'guideAliyunFields' as MessageKey },
        { provider: 'aws-s3' as const, fieldsKey: 'guideAwsFields' as MessageKey },
        { provider: 's3-compatible' as const, fieldsKey: 'guideS3Fields' as MessageKey }
      ] as const,
    []
  )

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const path = await window.api.exportDiagnostics()
      toast.success(tr('diagnosticsExported', { path }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="help-dialog">
        <DialogHeader>
          <DialogTitle>{tr('helpAndDiagnostics')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <section>
            <h3 className="mb-2 text-sm font-semibold">{tr('commonErrors')}</h3>
            <div className="flex flex-col gap-2">
              {errorGuides.map((guide) => (
                <Alert key={guide.code}>
                  <AlertDescription>
                    <strong>{tr(guide.titleKey)}</strong> — {tr(guide.descKey)}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">{tr('providerGuides')}</h3>
            <div className="flex flex-col gap-2 text-sm">
              {providerGuides.map((guide) => (
                <div key={guide.provider} className="rounded border p-2">
                  <p className="font-medium">{providerLabel(locale, guide.provider)}</p>
                  <p className="text-xs text-muted-foreground">
                    {tr('requiredFields', { fields: tr(guide.fieldsKey) })}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <Button onClick={handleExport} disabled={exporting} data-testid="export-diagnostics">
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {tr('exportDiagnostics')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
