import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useI18n } from '@/hooks/use-i18n'
import { TransferTaskRow } from './transfer-task-row'
import type { TransferTask } from '../../../../shared/types/storage'

interface TransferCenterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: TransferTask[]
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onClearCompleted: () => void
}

const TABS = ['all', 'upload', 'download', 'delete'] as const

const STATUS_FILTERS = ['all', 'queued', 'running', 'success', 'failed', 'cancelled'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const STATUS_LABEL_KEYS = {
  queued: 'taskQueued',
  running: 'taskRunning',
  success: 'taskSuccess',
  failed: 'taskFailed',
  cancelled: 'taskCancelled'
} as const

function matchesStatus(task: TransferTask, status: StatusFilter): boolean {
  return status === 'all' || task.status === status
}

export function TransferCenter({
  open,
  onOpenChange,
  tasks,
  onCancel,
  onRetry,
  onClearCompleted
}: TransferCenterProps): React.JSX.Element {
  const { tr } = useI18n()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === 'success' || t.status === 'cancelled').length,
    [tasks]
  )

  const handleConfirmClear = (): void => {
    onClearCompleted()
    setConfirmOpen(false)
  }

  const filterByType = (type?: string): TransferTask[] =>
    tasks.filter((t) => (type ? t.type === type : true) && matchesStatus(t, statusFilter))

  const tabLabel = (tab: (typeof TABS)[number]): string => {
    if (tab === 'all') return tr('tabAll')
    if (tab === 'upload') return tr('tabUpload')
    if (tab === 'download') return tr('tabDownload')
    return tr('tabDelete')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="transfer-center">
        <SheetHeader className="gap-3 pr-12">
          <SheetTitle>{tr('taskCenter')}</SheetTitle>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger
                className="w-36"
                aria-label={tr('filterByStatus')}
                data-testid="transfer-status-filter"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((status) => (
                  <SelectItem
                    key={status}
                    value={status}
                    data-testid={`transfer-status-filter-${status}`}
                  >
                    {status === 'all' ? tr('allStatuses') : tr(STATUS_LABEL_KEYS[status])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={completedCount === 0}
              onClick={() => setConfirmOpen(true)}
              data-testid="clear-completed"
            >
              {tr('clearCompleted')}
            </Button>
          </div>
        </SheetHeader>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent data-testid="clear-completed-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-destructive" />
                {tr('clearCompletedConfirmTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {tr('clearCompletedConfirm', { count: completedCount })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tr('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmClear} data-testid="confirm-clear-completed">
                {tr('confirmClear')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Tabs defaultValue="all" className="mt-4">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {tabLabel(tab)}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => (
            <TabsContent key={tab} value={tab}>
              <ScrollArea className="h-[calc(100vh-180px)]">
                <div className="flex flex-col gap-3 pr-4">
                  {filterByType(tab === 'all' ? undefined : tab).length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {tr(statusFilter === 'all' ? 'noTasks' : 'noTasksForFilter')}
                    </p>
                  ) : (
                    filterByType(tab === 'all' ? undefined : tab).map((task) => (
                      <TransferTaskRow
                        key={task.id}
                        task={task}
                        onCancel={onCancel}
                        onRetry={onRetry}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
