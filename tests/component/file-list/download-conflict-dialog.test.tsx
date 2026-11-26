import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DownloadConflictDialog,
  type DownloadConflictItem
} from '@/components/file-list/download-conflict-dialog'
import { renderWithProviders } from '../test-utils'

const conflicts: DownloadConflictItem[] = [
  { key: 'docs/a.txt', localPath: '/tmp/downloads/a.txt', fileName: 'a.txt' },
  { key: 'docs/b.txt', localPath: '/tmp/downloads/b.txt', fileName: 'b.txt' }
]

function renderDialog(
  onConfirm = vi.fn(),
  onOpenChange = vi.fn()
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <DownloadConflictDialog
      open
      onOpenChange={onOpenChange}
      conflicts={conflicts}
      onConfirm={onConfirm}
    />
  )
}

describe('DownloadConflictDialog', () => {
  it('defaults every conflict to rename', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderDialog(onConfirm)

    await user.click(screen.getByRole('button', { name: '开始下载' }))

    expect(onConfirm).toHaveBeenCalledWith({
      'docs/a.txt': 'rename',
      'docs/b.txt': 'rename'
    })
  })

  it('applies one choice to every conflict', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderDialog(onConfirm)

    const applyAll = screen.getByText('全部应用此选择').parentElement as HTMLElement
    await user.click(within(applyAll).getByRole('button', { name: '覆盖' }))
    await user.click(screen.getByRole('button', { name: '开始下载' }))

    expect(onConfirm).toHaveBeenCalledWith({
      'docs/a.txt': 'overwrite',
      'docs/b.txt': 'overwrite'
    })
  })

  it('supports a different action for each file', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderDialog(onConfirm)

    const firstRow = screen.getByText('a.txt').closest('li') as HTMLElement
    const secondRow = screen.getByText('b.txt').closest('li') as HTMLElement
    await user.click(within(firstRow).getByRole('button', { name: '跳过' }))
    await user.click(within(secondRow).getByRole('button', { name: '覆盖' }))
    await user.click(screen.getByRole('button', { name: '开始下载' }))

    expect(onConfirm).toHaveBeenCalledWith({
      'docs/a.txt': 'skip',
      'docs/b.txt': 'overwrite'
    })
  })

  it('closes without confirming when cancelled', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderDialog(vi.fn(), onOpenChange)

    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
