import { Download, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useI18n } from '@/hooks/use-i18n'
import type { MessageKey } from '@/lib/i18n'
import { formatBytes, formatDuration, formatSpeed } from '@/lib/utils'
import type { TransferTask } from '../../../../shared/types/storage'

const STATUS_KEYS: Record<string, MessageKey> = {
  queued: 'taskQueued',
  running: 'taskRunning',
  success: 'taskSuccess',
  failed: 'taskFailed',
  cancelled: 'taskCancelled'
}

const STATUS_VARIANT: Record<string, 'muted' | 'warning' | 'success' | 'destructive'> = {
  queued: 'muted',
  running: 'warning',
  success: 'success',
  failed: 'destructive',
  cancelled: 'muted'
}

interface TransferTaskRowProps {
  task: TransferTask
  onCancel: (id: string) => void
  onRetry: (id: string) => void
}

export function TransferTaskRow({
  task,
  onCancel,
  onRetry
}: TransferTaskRowProps): React.JSX.Element {
  const { tr } = useI18n()
  const Icon = task.type === 'upload' ? Upload : task.type === 'download' ? Download : Trash2
  const fileName = task.objectKey.split('/').pop() ?? task.objectKey
  const statusKey = STATUS_KEYS[task.status]

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3" data-testid="transfer-task">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{fileName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {task.bucket}/{task.objectKey}
            </p>
          </div>
        </div>
        {statusKey && (
          <Badge
            variant={STATUS_VARIANT[task.status]}
            data-testid="task-status"
            data-status={task.status}
          >
            {tr(statusKey)}
          </Badge>
        )}
      </div>

      {(task.status === 'running' || task.status === 'queued') &&
        task.type !== 'delete' &&
        task.progressPercent !== undefined && (
          <div className="flex flex-col gap-1">
            <Progress value={task.progressPercent} data-testid="task-progress" />
            <p className="text-xs text-muted-foreground">
              {task.progressPercent}% · {formatBytes(task.transferredBytes ?? 0)} /{' '}
              {formatBytes(task.totalBytes ?? 0)}
              {task.speedBytesPerSecond ? ` · ${formatSpeed(task.speedBytesPerSecond)}` : ''}
              {task.estimatedRemainingSeconds
                ? ` · ${tr('remaining', { time: formatDuration(task.estimatedRemainingSeconds) })}`
                : ''}
            </p>
          </div>
        )}

      {task.errorMessage && <p className="text-xs text-destructive">{task.errorMessage}</p>}

      <div className="flex gap-2">
        {(task.status === 'running' || task.status === 'queued') && (
          <Button size="sm" variant="outline" onClick={() => onCancel(task.id)}>
            <X className="size-3.5" />
            {tr('cancel')}
          </Button>
        )}
        {task.status === 'failed' && (
          <Button size="sm" variant="outline" onClick={() => onRetry(task.id)}>
            <RotateCcw className="size-3.5" />
            {tr('retry')}
          </Button>
        )}
      </div>
    </div>
  )
}
