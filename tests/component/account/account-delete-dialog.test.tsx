import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountDeleteDialog } from '@/components/account/account-delete-dialog'
import { renderWithProviders } from '../test-utils'
import type { AccountPublic } from '../../../src/shared/types/storage'

const account: AccountPublic = {
  id: 'acc-1',
  name: '七牛云生产',
  provider: 'qiniu',
  region: 'z0',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
  hasAccessKey: true,
  hasSecret: true,
  lastConnectionStatus: 'connected'
}

describe('AccountDeleteDialog', () => {
  it('shows account name and provider in confirmation', () => {
    renderWithProviders(
      <AccountDeleteDialog open onOpenChange={vi.fn()} account={account} onConfirm={vi.fn()} />
    )
    expect(screen.getByRole('heading', { name: '删除账户' })).toBeInTheDocument()
    expect(screen.getByText(/七牛云生产/)).toBeInTheDocument()
    expect(screen.getByText(/七牛云 Kodo/)).toBeInTheDocument()
    expect(screen.getByText(/区域：z0/)).toBeInTheDocument()
  })

  it('calls onConfirm when delete is confirmed', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderWithProviders(
      <AccountDeleteDialog open onOpenChange={vi.fn()} account={account} onConfirm={onConfirm} />
    )
    await user.click(screen.getByRole('button', { name: '确认删除' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('does not call onConfirm when cancelled', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    renderWithProviders(
      <AccountDeleteDialog
        open
        onOpenChange={onOpenChange}
        account={account}
        onConfirm={onConfirm}
      />
    )
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
