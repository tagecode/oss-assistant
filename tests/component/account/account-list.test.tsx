import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountList } from '@/components/account/account-list'
import { renderWithProviders } from '../test-utils'
import type { AccountPublic } from '../../../src/shared/types/storage'

const accounts: AccountPublic[] = [
  {
    id: 'acc-1',
    name: '七牛云生产',
    provider: 'qiniu',
    region: 'z0',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
    hasAccessKey: true,
    hasSecret: true,
    lastConnectionStatus: 'connected'
  },
  {
    id: 'acc-2',
    name: 'AWS 测试',
    provider: 'aws-s3',
    region: 'us-east-1',
    createdAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:00.000Z',
    hasAccessKey: true,
    hasSecret: true,
    lastConnectionStatus: 'failed'
  }
]

describe('AccountList', () => {
  it('renders account names, provider and connection status', () => {
    renderWithProviders(
      <AccountList
        accounts={accounts}
        selectedId="acc-1"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('七牛云生产')).toBeInTheDocument()
    expect(screen.getByText('七牛云 Kodo')).toBeInTheDocument()
    expect(screen.getByText(/已连接/)).toBeInTheDocument()
    expect(screen.getByText('AWS 测试')).toBeInTheDocument()
    expect(screen.getByText(/连接失败/)).toBeInTheDocument()
  })

  it('calls onEdit and onDelete from account menu', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    renderWithProviders(
      <AccountList
        accounts={accounts}
        selectedId="acc-1"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    )
    await user.click(screen.getByRole('button', { name: '七牛云生产 操作' }))
    await user.click(screen.getByRole('menuitem', { name: /编辑/ }))
    expect(onEdit).toHaveBeenCalledWith('acc-1')

    await user.click(screen.getByRole('button', { name: 'AWS 测试 操作' }))
    await user.click(screen.getByRole('menuitem', { name: /删除/ }))
    expect(onDelete).toHaveBeenCalledWith('acc-2')
  })
})
