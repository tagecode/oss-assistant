import { create } from 'zustand'

interface AppState {
  selectedAccountId: string | null
  selectedBucket: string | null
  currentPrefix: string
  selectedKeys: Set<string>
  transferCenterOpen: boolean
  settingsOpen: boolean
  helpOpen: boolean
  accountDialogOpen: boolean
  editingAccountId: string | null
  setSelectedAccountId: (id: string | null) => void
  setSelectedBucket: (bucket: string | null) => void
  setCurrentPrefix: (prefix: string) => void
  setSelectedKeys: (keys: Set<string>) => void
  toggleKey: (key: string) => void
  clearSelection: () => void
  setTransferCenterOpen: (open: boolean) => void
  toggleTransferCenter: () => void
  setSettingsOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setAccountDialogOpen: (open: boolean, editingId?: string | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedAccountId: null,
  selectedBucket: null,
  currentPrefix: '',
  selectedKeys: new Set(),
  transferCenterOpen: false,
  settingsOpen: false,
  helpOpen: false,
  accountDialogOpen: false,
  editingAccountId: null,
  setSelectedAccountId: (id) =>
    set({
      selectedAccountId: id,
      selectedBucket: null,
      currentPrefix: '',
      selectedKeys: new Set()
    }),
  setSelectedBucket: (bucket) =>
    set({ selectedBucket: bucket, currentPrefix: '', selectedKeys: new Set() }),
  setCurrentPrefix: (prefix) => set({ currentPrefix: prefix, selectedKeys: new Set() }),
  setSelectedKeys: (keys) => set({ selectedKeys: keys }),
  toggleKey: (key) => {
    const next = new Set(get().selectedKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    set({ selectedKeys: next })
  },
  clearSelection: () => set({ selectedKeys: new Set() }),
  setTransferCenterOpen: (open) => set({ transferCenterOpen: open }),
  toggleTransferCenter: () => set((state) => ({ transferCenterOpen: !state.transferCenterOpen })),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  setAccountDialogOpen: (open, editingId = null) =>
    set({ accountDialogOpen: open, editingAccountId: editingId })
}))
