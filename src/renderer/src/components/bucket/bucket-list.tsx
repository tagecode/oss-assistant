import { Database } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/hooks/use-i18n'
import { cn, formatDate } from '@/lib/utils'
import type { BucketInfo } from '../../../../shared/types/storage'

interface BucketListProps {
  buckets: BucketInfo[]
  selectedBucket: string | null
  isLoading: boolean
  onSelect: (name: string) => void
}

export function BucketList({
  buckets,
  selectedBucket,
  isLoading,
  onSelect
}: BucketListProps): React.JSX.Element {
  const { tr, locale } = useI18n()

  return (
    <div className="flex h-full w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{tr('buckets')}</span>
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex flex-col gap-2 px-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : buckets.length === 0 ? (
          <p className="px-3 text-xs text-muted-foreground">{tr('noBuckets')}</p>
        ) : (
          <div className="flex flex-col gap-0.5 px-2 pb-2">
            {buckets.map((bucket) => (
              <button
                key={bucket.name}
                type="button"
                onClick={() => onSelect(bucket.name)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors cursor-pointer',
                  selectedBucket === bucket.name
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary'
                    : 'hover:bg-sidebar-accent/50'
                )}
              >
                <Database className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{bucket.name}</div>
                  {bucket.region && (
                    <div className="truncate text-xs text-muted-foreground">{bucket.region}</div>
                  )}
                  {bucket.createdAt && (
                    <div className="truncate text-xs text-muted-foreground">
                      {formatDate(bucket.createdAt, locale)}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
