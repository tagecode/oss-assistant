import { describe, expect, it } from 'vitest'
import type { TransferTask } from '../../../src/shared/types/storage'

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

const baseTask: TransferTask = {
  id: '1',
  type: 'upload',
  status: 'success',
  accountId: 'acc-1',
  bucket: 'assets',
  objectKey: 'readme.txt',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('refresh on transfer', () => {
  it('refreshes root listing for uploads without path separator', () => {
    expect(shouldRefreshList(baseTask, { accountId: 'acc-1', bucket: 'assets', prefix: '' })).toBe(
      true
    )
  })

  it('refreshes nested prefix when object key matches current folder', () => {
    expect(
      shouldRefreshList(
        { ...baseTask, objectKey: 'docs/guide.pdf' },
        { accountId: 'acc-1', bucket: 'assets', prefix: 'docs/' }
      )
    ).toBe(true)
  })

  it('ignores downloads and mismatched buckets', () => {
    expect(
      shouldRefreshList(
        { ...baseTask, type: 'download' },
        { accountId: 'acc-1', bucket: 'assets', prefix: '' }
      )
    ).toBe(false)
    expect(shouldRefreshList(baseTask, { accountId: 'acc-1', bucket: 'other', prefix: '' })).toBe(
      false
    )
  })
})
