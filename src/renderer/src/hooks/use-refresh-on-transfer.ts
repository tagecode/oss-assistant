import { useEffect, useRef } from 'react'
import type { TransferTask } from '../../../shared/types/storage'

function isObjectInCurrentPrefix(objectKey: string, prefix: string): boolean {
  if (!prefix) {
    return !objectKey.includes('/')
  }
  return objectKey.startsWith(prefix)
}

function shouldRefreshList(
  task: TransferTask,
  context: { accountId: string | null; bucket: string | null; prefix: string }
): boolean {
  if (!context.accountId || !context.bucket) return false
  if (task.accountId !== context.accountId || task.bucket !== context.bucket) return false
  if (task.type !== 'upload' && task.type !== 'delete') return false
  return isObjectInCurrentPrefix(task.objectKey, context.prefix)
}

export function useRefreshOnTransferComplete(
  tasks: TransferTask[],
  refetch: () => void,
  context: { accountId: string | null; bucket: string | null; prefix: string }
): void {
  const handledRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let shouldRefetch = false
    for (const task of tasks) {
      if (task.status !== 'success') continue
      if (handledRef.current.has(task.id)) continue
      if (!shouldRefreshList(task, context)) continue
      handledRef.current.add(task.id)
      shouldRefetch = true
    }
    if (shouldRefetch) {
      refetch()
    }
  }, [tasks, context, refetch])
}
