import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TransferTask } from '../../../shared/types/storage'

export function useTransfers(): {
  tasks: TransferTask[]
  activeCount: number
  refetch: () => void
  cancel: (id: string) => Promise<void>
  retry: (id: string) => Promise<void>
  clearCompleted: () => Promise<void>
} {
  const [tasks, setTasks] = useState<TransferTask[]>([])

  const { refetch } = useQuery({
    queryKey: ['transfers'],
    queryFn: () => window.api.listTransfers(),
    refetchInterval: 5000
  })

  useEffect(() => {
    void window.api.listTransfers().then(setTasks)
    const unsubscribe = window.api.onTransferUpdate(setTasks)
    return unsubscribe
  }, [])

  const activeCount = tasks.filter((t) => t.status === 'running' || t.status === 'queued').length

  return {
    tasks,
    activeCount,
    refetch: () => void refetch(),
    cancel: (id) => window.api.cancelTransfer(id),
    retry: (id) => window.api.retryTransfer(id),
    clearCompleted: () => window.api.clearCompletedTransfers()
  }
}
