import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Providers } from './app/providers'
import { AppHeader } from './components/layout/app-header'
import { StatusBar } from './components/layout/status-bar'
import { Toolbar } from './components/layout/toolbar'
import { AccountList, AccountEmptyState } from './components/account/account-list'
import { AccountFormDialog } from './components/account/account-form-dialog'
import { AccountDeleteDialog } from './components/account/account-delete-dialog'
import { BucketList } from './components/bucket/bucket-list'
import { PathBreadcrumb } from './components/file-list/path-breadcrumb'
import { FileBrowser } from './components/file-list/file-browser'
import { DeleteObjectsDialog } from './components/file-list/delete-objects-dialog'
import { DownloadConflictDialog } from './components/file-list/download-conflict-dialog'
import { TransferCenter } from './components/transfer/transfer-center'
import { SettingsDialog } from './components/settings/settings-dialog'
import { HelpDialog } from './components/diagnostics/help-dialog'
import { Alert, AlertDescription } from './components/ui/alert'
import { Button } from './components/ui/button'
import { useAppStore } from './stores/app-store'
import { useAccounts } from './hooks/use-accounts'
import { useBuckets } from './hooks/use-buckets'
import { useObjects } from './hooks/use-objects'
import { useTransfers } from './hooks/use-transfers'
import { useRefreshOnTransferComplete } from './hooks/use-refresh-on-transfer'
import { useTheme } from './hooks/use-theme'
import { useFileActions } from './hooks/use-file-actions'
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts'
import { useI18n } from './hooks/use-i18n'
import type { AccountInput, StorageObject } from '../../shared/types/storage'

function AppContent(): React.JSX.Element {
  useTheme()
  const { tr } = useI18n()
  const store = useAppStore()
  const { accounts, createAccount, updateAccount, deleteAccount, testConnection } = useAccounts()
  const {
    buckets,
    isLoading: bucketsLoading,
    error: bucketsError,
    refetch: refetchBuckets
  } = useBuckets(store.selectedAccountId)
  const {
    objects,
    isLoading: objectsLoading,
    isFetchingMore,
    hasMore,
    error: objectsError,
    refetch: refetchObjects,
    loadMore
  } = useObjects(store.selectedAccountId, store.selectedBucket, store.currentPrefix)
  const { tasks, activeCount, cancel, retry, clearCompleted } = useTransfers()

  useRefreshOnTransferComplete(tasks, () => void refetchObjects(), {
    accountId: store.selectedAccountId,
    bucket: store.selectedBucket,
    prefix: store.currentPrefix
  })

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null)

  const selectedAccount = accounts.find((a) => a.id === store.selectedAccountId)

  const handleRefresh = useCallback(() => {
    void refetchObjects()
    void refetchBuckets()
  }, [refetchObjects, refetchBuckets])

  const {
    handleUpload,
    handleUploadPaths,
    handleDownload,
    handleDelete,
    handleCopyPath,
    downloadConflicts,
    downloadConflictOpen,
    setDownloadConflictOpen,
    handleDownloadConflictConfirm
  } = useFileActions({
    objects,
    onDeleteRequest: () => setDeleteDialogOpen(true)
  })

  useKeyboardShortcuts({
    onUpload: () => void handleUpload(),
    onDownload: () => void handleDownload(),
    onDelete: handleDelete,
    onRefresh: handleRefresh,
    enabled: !!store.selectedBucket
  })

  useEffect(() => {
    if (accounts.length > 0 && !store.selectedAccountId) {
      store.setSelectedAccountId(accounts[0].id)
    }
  }, [accounts, store.selectedAccountId, store])

  const handleDeleteConfirm = useCallback(async () => {
    if (!store.selectedAccountId || !store.selectedBucket) return
    const keys = Array.from(store.selectedKeys)
    await window.api.createDelete({
      accountId: store.selectedAccountId,
      bucket: store.selectedBucket,
      keys
    })
    setDeleteDialogOpen(false)
    store.clearSelection()
    store.setTransferCenterOpen(true)
    toast.success(tr('deleteTasksAdded', { count: keys.length }))
  }, [store, tr])

  const handleObjectOpen = (obj: StorageObject): void => {
    if (obj.isDirectory) return
    store.toggleKey(obj.key)
  }

  const handleObjectDoubleClick = (obj: StorageObject): void => {
    if (obj.isDirectory) {
      store.setCurrentPrefix(obj.key)
    }
  }

  const handleSaveAccount = async (input: Parameters<typeof updateAccount>[1]): Promise<void> => {
    if (store.editingAccountId) {
      await updateAccount(store.editingAccountId, input)
      toast.success(tr('accountUpdated'))
    } else {
      const account = await createAccount(input as AccountInput)
      store.setSelectedAccountId(account.id)
      toast.success(tr('accountAdded'))
    }
    store.setAccountDialogOpen(false)
  }

  const handleDeleteAccountConfirm = useCallback(async (): Promise<void> => {
    if (!deleteAccountId) return
    await deleteAccount(deleteAccountId)
    if (store.selectedAccountId === deleteAccountId) {
      const remaining = accounts.filter((a) => a.id !== deleteAccountId)
      store.setSelectedAccountId(remaining[0]?.id ?? null)
    }
    setDeleteAccountId(null)
    toast.success(tr('accountDeleted'))
  }, [deleteAccountId, deleteAccount, store, accounts, tr])

  const connectionStatus = selectedAccount
    ? selectedAccount.lastConnectionStatus === 'connected'
      ? tr('connectedAccount', { name: selectedAccount.name })
      : tr('accountLabel', { name: selectedAccount.name })
    : undefined

  const sharedDialogs = (
    <>
      <AccountFormDialog
        open={store.accountDialogOpen}
        onOpenChange={(open) => store.setAccountDialogOpen(open)}
        account={accounts.find((a) => a.id === store.editingAccountId)}
        onSave={handleSaveAccount}
        onTest={testConnection}
      />
      <AccountDeleteDialog
        open={!!deleteAccountId}
        onOpenChange={(open) => !open && setDeleteAccountId(null)}
        account={accounts.find((a) => a.id === deleteAccountId)}
        onConfirm={() => void handleDeleteAccountConfirm()}
      />
      <DeleteObjectsDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        objectKeys={Array.from(store.selectedKeys)}
        bucket={store.selectedBucket ?? ''}
        onConfirm={handleDeleteConfirm}
      />
      <DownloadConflictDialog
        open={downloadConflictOpen}
        onOpenChange={setDownloadConflictOpen}
        conflicts={downloadConflicts}
        onConfirm={(actions) => void handleDownloadConflictConfirm(actions)}
      />
      <TransferCenter
        open={store.transferCenterOpen}
        onOpenChange={store.setTransferCenterOpen}
        tasks={tasks}
        onCancel={cancel}
        onRetry={retry}
        onClearCompleted={clearCompleted}
      />
      <SettingsDialog open={store.settingsOpen} onOpenChange={store.setSettingsOpen} />
      <HelpDialog open={store.helpOpen} onOpenChange={store.setHelpOpen} />
    </>
  )

  if (accounts.length === 0) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <AppHeader
          onOpenSettings={() => store.setSettingsOpen(true)}
          onOpenHelp={() => store.setHelpOpen(true)}
        />
        <AccountEmptyState onAdd={() => store.setAccountDialogOpen(true)} />
        <StatusBar
          activeTaskCount={activeCount}
          onOpenTransferCenter={() => store.setTransferCenterOpen(true)}
        />
        {sharedDialogs}
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader
        onOpenSettings={() => store.setSettingsOpen(true)}
        onOpenHelp={() => store.setHelpOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <AccountList
          accounts={accounts}
          selectedId={store.selectedAccountId}
          onSelect={store.setSelectedAccountId}
          onAdd={() => store.setAccountDialogOpen(true)}
          onEdit={(id) => store.setAccountDialogOpen(true, id)}
          onDelete={setDeleteAccountId}
        />

        {store.selectedAccountId && (
          <BucketList
            buckets={buckets}
            selectedBucket={store.selectedBucket}
            isLoading={bucketsLoading}
            onSelect={store.setSelectedBucket}
          />
        )}

        <main className="flex flex-1 flex-col overflow-hidden">
          {store.selectedBucket ? (
            <>
              <PathBreadcrumb
                bucket={store.selectedBucket}
                prefix={store.currentPrefix}
                onNavigate={store.setCurrentPrefix}
              />
              <Toolbar
                selectedCount={store.selectedKeys.size}
                onUpload={() => void handleUpload()}
                onDownload={() => void handleDownload()}
                onDelete={handleDelete}
                onRefresh={handleRefresh}
              />
              {(bucketsError || objectsError) && (
                <Alert variant="destructive" className="mx-4 mt-2">
                  <AlertDescription className="flex items-center justify-between">
                    <span>{(bucketsError ?? objectsError)?.message ?? tr('loadingFailed')}</span>
                    <Button size="sm" variant="outline" onClick={handleRefresh}>
                      {tr('retry')}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex-1 overflow-hidden">
                <FileBrowser
                  objects={objects}
                  selectedKeys={store.selectedKeys}
                  isLoading={objectsLoading}
                  hasMore={hasMore}
                  isFetchingMore={isFetchingMore}
                  onLoadMore={loadMore}
                  bucket={store.selectedBucket}
                  prefix={store.currentPrefix}
                  onToggleSelect={store.toggleKey}
                  onOpen={handleObjectOpen}
                  onDoubleClick={handleObjectDoubleClick}
                  onUpload={() => void handleUpload()}
                  onUploadPaths={(paths) => void handleUploadPaths(paths)}
                  onDownload={() => void handleDownload()}
                  onDelete={handleDelete}
                  onCopyPath={(key) => void handleCopyPath(key)}
                  onRefresh={handleRefresh}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {bucketsLoading ? tr('loadingBuckets') : tr('selectBucket')}
            </div>
          )}
        </main>
      </div>

      <StatusBar
        activeTaskCount={activeCount}
        connectionStatus={connectionStatus}
        onOpenTransferCenter={() => store.setTransferCenterOpen(true)}
      />

      {sharedDialogs}
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    <Providers>
      <AppContent />
    </Providers>
  )
}

export default App
