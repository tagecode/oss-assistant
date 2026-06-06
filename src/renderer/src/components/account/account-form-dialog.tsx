import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, CircleAlert, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useI18n } from '@/hooks/use-i18n'
import type { MessageKey } from '@/lib/i18n'
import { isProviderFieldRequired, validateAccountForm } from '@/lib/account-form-validation'
import { getDefaultRegion, getRegionLabel, getRegionOptions } from '@/lib/provider-regions'
import { cn } from '@/lib/utils'
import type { AccountInput, AccountPublic, StorageProvider } from '../../../../shared/types/storage'

type FormData = {
  name: string
  provider: 'qiniu' | 'aliyun-oss' | 'aws-s3' | 's3-compatible'
  accessKeyId?: string
  secretKey?: string
  region?: string
  endpoint?: string
  bucketDomain?: string
  pathStyleAccess?: boolean
}

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: AccountPublic | null
  onSave: (input: Partial<AccountInput>) => Promise<void>
  onTest: (input: Partial<AccountInput>, accountId?: string) => Promise<void>
}

function RequiredMark(): React.JSX.Element {
  return (
    <span className="text-destructive" aria-hidden="true">
      {' '}
      *
    </span>
  )
}

function AccountFormBody({
  open,
  onOpenChange,
  account,
  onSave,
  onTest
}: AccountFormDialogProps): React.JSX.Element {
  const { tr, locale } = useI18n()
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showSecret, setShowSecret] = useState(false)

  const accountSchema = useMemo(
    () =>
      z
        .object({
          name: z.string(),
          provider: z.enum(['qiniu', 'aliyun-oss', 'aws-s3', 's3-compatible']),
          accessKeyId: z.string().optional(),
          secretKey: z.string().optional(),
          region: z.string().optional(),
          endpoint: z.string().optional(),
          bucketDomain: z.string().optional(),
          pathStyleAccess: z.boolean().optional()
        })
        .superRefine((data, ctx) => {
          for (const issue of validateAccountForm(data, account, {
            validationAccountName: tr('validationAccountName'),
            validationAccessKeyId: tr('validationAccessKeyId'),
            validationSecretKey: tr('validationSecretKey'),
            validationRegion: tr('validationRegion'),
            validationBucketDomain: tr('validationBucketDomain'),
            validationEndpoint: tr('validationEndpoint')
          })) {
            ctx.addIssue({
              code: 'custom',
              message: issue.message,
              path: [issue.path]
            })
          }
        }),
    [tr, account]
  )

  const form = useForm<FormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account?.name ?? '',
      provider: account?.provider ?? 'qiniu',
      accessKeyId: '',
      secretKey: '',
      region: account?.region ?? getDefaultRegion(account?.provider ?? 'qiniu'),
      endpoint: account?.endpoint ?? '',
      bucketDomain: account?.bucketDomain ?? ''
    }
  })

  const provider = useWatch({ control: form.control, name: 'provider' })
  const region = useWatch({ control: form.control, name: 'region' })
  const needsEndpoint = provider === 's3-compatible'
  const regionOptions = useMemo(
    () => getRegionOptions(provider, account?.region),
    [provider, account?.region]
  )

  const handleProviderChange = (value: FormData['provider']): void => {
    form.setValue('provider', value)
    form.setValue('region', getDefaultRegion(value))
  }

  useEffect(() => {
    if (!open) return
    form.reset({
      name: account?.name ?? '',
      provider: account?.provider ?? 'qiniu',
      accessKeyId: '',
      secretKey: '',
      region: account?.region ?? getDefaultRegion(account?.provider ?? 'qiniu'),
      endpoint: account?.endpoint ?? '',
      bucketDomain: account?.bucketDomain ?? ''
    })
  }, [open, account, form])

  const buildPayload = (): Partial<AccountInput> => {
    const values = form.getValues()
    const payload: Partial<AccountInput> = {
      name: values.name,
      provider: values.provider as StorageProvider,
      region: values.region || undefined,
      endpoint: values.endpoint || undefined,
      bucketDomain: values.bucketDomain || undefined,
      pathStyleAccess: values.pathStyleAccess
    }
    if (values.accessKeyId) payload.accessKeyId = values.accessKeyId
    if (values.secretKey) payload.secretKey = values.secretKey
    return payload
  }

  const handleTest = async (): Promise<void> => {
    const valid = await form.trigger()
    if (!valid) return
    setTesting(true)
    setTestResult(null)
    try {
      await onTest(buildPayload(), account?.id)
      setTestResult({ ok: true, message: tr('connectionTestSuccess') })
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : tr('connectionTestFailed')
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    const valid = await form.trigger()
    if (!valid) return
    setSaving(true)
    try {
      const payload = buildPayload()
      if (!account && (!payload.accessKeyId || !payload.secretKey)) {
        throw new Error(tr('validationSecretKey'))
      }
      await onSave(payload)
      onOpenChange(false)
      form.reset()
      setTestResult(null)
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : tr('saveFailed')
      })
    } finally {
      setSaving(false)
    }
  }

  const providerOptions: { value: FormData['provider']; labelKey: MessageKey }[] = [
    { value: 'qiniu', labelKey: 'providerQiniu' },
    { value: 'aliyun-oss', labelKey: 'providerAliyun' },
    { value: 'aws-s3', labelKey: 'providerAwsS3' },
    { value: 's3-compatible', labelKey: 'providerS3Compatible' }
  ]

  return (
    <>
      <DialogHeader>
        <DialogTitle>{account ? tr('editAccount') : tr('addAccount')}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">{tr('accountName')}</Label>
          <Input id="name" {...form.register('name')} />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="provider">{tr('provider')}</Label>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger id="provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {tr(opt.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accessKeyId">
            {tr('accessKeyId')}
            <RequiredMark />
          </Label>
          <Input
            id="accessKeyId"
            placeholder={account?.hasAccessKey ? tr('accessKeyPlaceholderEdit') : ''}
            {...form.register('accessKeyId')}
          />
          {form.formState.errors.accessKeyId && (
            <p className="text-xs text-destructive">{form.formState.errors.accessKeyId.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="secretKey">
            {tr('secretKey')}
            <RequiredMark />
          </Label>
          <div className="flex gap-2">
            <Input
              id="secretKey"
              type={showSecret ? 'text' : 'password'}
              placeholder={account?.hasSecret ? tr('secretPlaceholderEdit') : ''}
              {...form.register('secretKey', { required: !account })}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSecret(!showSecret)}
            >
              {showSecret ? tr('hide') : tr('show')}
            </Button>
          </div>
          {form.formState.errors.secretKey && (
            <p className="text-xs text-destructive">{form.formState.errors.secretKey.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="region">
            {tr('region')}
            <RequiredMark />
          </Label>
          <Select
            value={region || getDefaultRegion(provider)}
            onValueChange={(v) => form.setValue('region', v, { shouldValidate: true })}
          >
            <SelectTrigger id="region">
              <SelectValue placeholder={tr('selectRegion')} />
            </SelectTrigger>
            <SelectContent>
              {regionOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {getRegionLabel(opt, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.region && (
            <p className="text-xs text-destructive">{form.formState.errors.region.message}</p>
          )}
        </div>

        {needsEndpoint && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endpoint">
              {tr('endpoint')}
              {isProviderFieldRequired(provider, 'endpoint') && <RequiredMark />}
            </Label>
            <Input id="endpoint" {...form.register('endpoint')} />
            {form.formState.errors.endpoint && (
              <p className="text-xs text-destructive">{form.formState.errors.endpoint.message}</p>
            )}
          </div>
        )}

        {provider === 'qiniu' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bucketDomain">
              {tr('bucketDomain')}
              <RequiredMark />
            </Label>
            <Input id="bucketDomain" {...form.register('bucketDomain')} />
            {form.formState.errors.bucketDomain && (
              <p className="text-xs text-destructive">
                {form.formState.errors.bucketDomain.message}
              </p>
            )}
          </div>
        )}
      </div>

      {testResult && (
        <Alert
          variant={testResult.ok ? 'success' : 'destructive'}
          className={cn(
            'flex gap-3 animate-in fade-in-50 duration-200',
            '[&>svg]:static [&>svg]:left-auto [&>svg]:top-auto [&>svg+div]:translate-y-0 [&>svg~*]:pl-0',
            testResult.ok ? 'items-center' : 'items-start'
          )}
          data-testid={testResult.ok ? 'connection-test-success' : 'connection-test-error'}
        >
          {testResult.ok ? (
            <CheckCircle2 className="size-5 shrink-0" />
          ) : (
            <CircleAlert className="mt-0.5 size-5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <AlertTitle className="mb-0 font-semibold leading-snug">
              {testResult.ok ? tr('connectionTestSuccess') : tr('connectionTestFailed')}
            </AlertTitle>
            {!testResult.ok && testResult.message !== tr('connectionTestFailed') && (
              <AlertDescription className="mt-1">{testResult.message}</AlertDescription>
            )}
          </div>
        </Alert>
      )}

      <DialogFooter className="gap-2 pt-2 sm:gap-3">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={testing || saving}
          data-testid="test-connection"
        >
          {testing && <Loader2 className="size-4 animate-spin" />}
          {tr('testConnection')}
        </Button>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {tr('cancel')}
        </Button>
        <Button onClick={handleSave} disabled={testing || saving} data-testid="save-account">
          {saving && <Loader2 className="size-4 animate-spin" />}
          {tr('save')}
        </Button>
      </DialogFooter>
    </>
  )
}

export function AccountFormDialog(props: AccountFormDialogProps): React.JSX.Element {
  const { locale } = useI18n()
  const formSessionKey = props.open ? `${locale}:${props.account?.id ?? 'new'}` : `${locale}:idle`

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="account-form-dialog">
        {props.open ? <AccountFormBody key={formSessionKey} {...props} /> : null}
      </DialogContent>
    </Dialog>
  )
}
