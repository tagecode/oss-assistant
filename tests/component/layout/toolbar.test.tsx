import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toolbar } from '@/components/layout/toolbar'
import { renderWithProviders } from '../test-utils'

describe('Toolbar', () => {
  it('renders upload, download, delete and refresh actions', () => {
    renderWithProviders(
      <Toolbar
        selectedCount={0}
        onUpload={vi.fn()}
        onDownload={vi.fn()}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: '上传' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下载' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument()
    expect(screen.getByTestId('toolbar-refresh')).toBeInTheDocument()
  })

  it('disables download and delete when nothing is selected', () => {
    renderWithProviders(
      <Toolbar
        selectedCount={0}
        onUpload={vi.fn()}
        onDownload={vi.fn()}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: '下载' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '删除' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '上传' })).toBeEnabled()
  })

  it('shows selected count and enables bulk actions', async () => {
    const user = userEvent.setup()
    const onDownload = vi.fn()
    const onDelete = vi.fn()

    renderWithProviders(
      <Toolbar
        selectedCount={3}
        onUpload={vi.fn()}
        onDownload={onDownload}
        onDelete={onDelete}
        onRefresh={vi.fn()}
      />
    )

    expect(screen.getByText('已选 3 项')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '下载' }))
    await user.click(screen.getByRole('button', { name: '删除' }))

    expect(onDownload).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('calls upload and refresh handlers', async () => {
    const user = userEvent.setup()
    const onUpload = vi.fn()
    const onRefresh = vi.fn()

    renderWithProviders(
      <Toolbar
        selectedCount={0}
        onUpload={onUpload}
        onDownload={vi.fn()}
        onDelete={vi.fn()}
        onRefresh={onRefresh}
      />
    )

    await user.click(screen.getByRole('button', { name: '上传' }))
    await user.click(screen.getByTestId('toolbar-refresh'))

    expect(onUpload).toHaveBeenCalledOnce()
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('disables all actions when disabled', () => {
    renderWithProviders(
      <Toolbar
        selectedCount={2}
        disabled
        onUpload={vi.fn()}
        onDownload={vi.fn()}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: '上传' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '下载' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '删除' })).toBeDisabled()
    expect(screen.getByTestId('toolbar-refresh')).toBeDisabled()
  })
})
