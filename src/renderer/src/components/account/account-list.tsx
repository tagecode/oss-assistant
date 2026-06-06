import { MoreHorizontal, Pencil, Plus, Server, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/hooks/use-i18n'
import { providerLabel } from '@/lib/i18n'
import { cn, formatDate } from '@/lib/utils'
import type { AccountPublic } from '../../../../shared/types/storage'

interface AccountListProps {
  accounts: AccountPublic[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

function StatusDot({ status }: { status?: string }): React.JSX.Element {
  const color =
    status === 'connected'
      ? 'bg-primary'
      : status === 'failed'
        ? 'bg-destructive'
        : 'bg-muted-foreground'
  return <span className={cn('size-2 shrink-0 rounded-full', color)} />
}

export function AccountList({
  accounts,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  onDelete
}: AccountListProps): React.JSX.Element {
  const { tr, locale } = useI18n()

  const statusLabel = (status?: string): string => {
    if (status === 'connected') return tr('connected')
    if (status === 'failed') return tr('connectionFailed')
    return tr('notTested')
  }

  return (
    <div className="flex h-full w-[200px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{tr('accounts')}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onAdd}
          aria-label={tr('addAccount')}
          data-testid="add-account"
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={cn(
                'group relative flex w-full items-center rounded-md transition-colors',
                selectedId === account.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary'
                  : 'hover:bg-sidebar-accent/50'
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(account.id)}
                className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-2 pr-10 text-left text-sm cursor-pointer"
              >
                <StatusDot status={account.lastConnectionStatus} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{account.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {providerLabel(locale, account.provider)}
                  </div>
                  <div className="truncate text-xs text-muted-foreground/80">
                    {statusLabel(account.lastConnectionStatus)}
                    {account.updatedAt ? ` · ${formatDate(account.updatedAt, locale)}` : ''}
                  </div>
                </div>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'absolute right-2 top-1/2 z-10 size-8 shrink-0 -translate-y-1/2',
                      'text-muted-foreground opacity-0 transition-opacity',
                      'hover:bg-sidebar-accent hover:text-foreground',
                      'group-hover:opacity-100 data-[state=open]:opacity-100',
                      'data-[state=open]:bg-sidebar-accent data-[state=open]:text-foreground'
                    )}
                    aria-label={tr('accountActions', { name: account.name })}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(account.id)}>
                    <Pencil className="size-4" />
                    {tr('edit')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(account.id)}
                  >
                    <Trash2 className="size-4" />
                    {tr('delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export function AccountEmptyState({ onAdd }: { onAdd: () => void }): React.JSX.Element {
  const { tr } = useI18n()

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 p-8"
      data-testid="empty-accounts"
    >
      <Server className="size-16 text-muted-foreground/40" />
      <div className="text-center">
        <h2 className="text-lg font-semibold">{tr('noAccounts')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tr('noAccountsHint')}</p>
      </div>
      <Button onClick={onAdd} data-testid="add-account">
        {tr('addAccount')}
      </Button>
    </div>
  )
}
