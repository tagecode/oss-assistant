import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransferCenter } from '@/components/transfer/transfer-center'
import { renderWithProviders } from '../test-utils'
import type { TransferTask } from '../../../src/shared/types/storage'

const mockTasks: TransferTask[] = [
  {
    id: '1',
    type: 'upload',
    status: 'running',
    accountId: 'acc-1',
    bucket: 'assets',
    objectKey: 'logo.png',
    progressPercent: 52,
    transferredBytes: 128000000,
    totalBytes: 245000000,
    speedBytesPerSecond: 2400000,
    estimatedRemainingSeconds: 48,
    createdAt: '2026-06-05T00:00:00.000Z',
    updatedAt: '2026-06-05T00:00:00.000Z'
  },
  {
    id: '2',
    type: 'download',
    status: 'failed',
    accountId: 'acc-1',
    bucket: 'assets',
    objectKey: 'archive.zip',
    errorMessage: '网络连接失败',
    createdAt: '2026-06-05T00:00:00.000Z',
    updatedAt: '2026-06-05T00:00:00.000Z'
  }
]

describe('TransferCenter', () => {
  it('renders task progress and status', () => {
    renderWithProviders(
      <TransferCenter
        open
        onOpenChange={vi.fn()}
        tasks={mockTasks}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onClearCompleted={vi.fn()}
      />
    )
    expect(screen.getByText('任务中心')).toBeInTheDocument()
    expect(screen.getByText('logo.png')).toBeInTheDocument()
    expect(screen.getByText(/52%/)).toBeInTheDocument()
    expect(screen.getByText('网络连接失败')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  it('disables clear completed when there are no finished tasks', () => {
    renderWithProviders(
      <TransferCenter
        open
        onOpenChange={vi.fn()}
        tasks={mockTasks}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onClearCompleted={vi.fn()}
      />
    )

    expect(screen.getByTestId('clear-completed')).toBeDisabled()
  })

  it('asks for confirmation before clearing completed tasks', async () => {
    const user = userEvent.setup()
    const onClearCompleted = vi.fn()
    const completedTask: TransferTask = {
      ...mockTasks[0],
      id: '3',
      status: 'success',
      progressPercent: 100
    }

    renderWithProviders(
      <TransferCenter
        open
        onOpenChange={vi.fn()}
        tasks={[...mockTasks, completedTask]}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onClearCompleted={onClearCompleted}
      />
    )

    await user.click(screen.getByTestId('clear-completed'))
    expect(screen.getByTestId('clear-completed-dialog')).toBeInTheDocument()
    expect(screen.getByText(/将移除 1 条已完成或已取消的传输记录/)).toBeInTheDocument()

    await user.click(screen.getByTestId('confirm-clear-completed'))
    expect(onClearCompleted).toHaveBeenCalledOnce()
  })
})
