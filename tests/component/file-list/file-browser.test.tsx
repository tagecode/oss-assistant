import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { FileBrowser } from '@/components/file-list/file-browser'
import { renderWithProviders } from '../test-utils'
import type { StorageObject } from '../../../src/shared/types/storage'

const mockObjects: StorageObject[] = [
  {
    key: 'images/',
    name: 'images',
    prefix: '',
    size: 0,
    isDirectory: true
  },
  {
    key: 'logo.png',
    name: 'logo.png',
    prefix: '',
    size: 28000,
    lastModified: '2026-06-01T00:00:00.000Z',
    isDirectory: false
  }
]

const defaultProps = {
  objects: mockObjects,
  selectedKeys: new Set<string>(),
  isLoading: false,
  bucket: 'assets-prod',
  prefix: '',
  onToggleSelect: vi.fn(),
  onOpen: vi.fn(),
  onDoubleClick: vi.fn(),
  onUpload: vi.fn(),
  onUploadPaths: vi.fn(),
  onDownload: vi.fn(),
  onDelete: vi.fn(),
  onCopyPath: vi.fn(),
  onRefresh: vi.fn()
}

describe('FileBrowser', () => {
  it('renders virtual table header', async () => {
    renderWithProviders(
      <div style={{ height: 400 }}>
        <FileBrowser {...defaultProps} />
      </div>
    )
    expect(await screen.findByText('名称')).toBeInTheDocument()
    expect(screen.getByText('大小')).toBeInTheDocument()
    expect(screen.getByText('存储类型')).toBeInTheDocument()
    expect(screen.getByText('修改时间')).toBeInTheDocument()
  })

  it('shows empty state when no objects', async () => {
    renderWithProviders(<FileBrowser {...defaultProps} objects={[]} />)
    expect(await screen.findByText('当前目录为空')).toBeInTheDocument()
    expect(screen.getByText(/拖拽文件到此处/)).toBeInTheDocument()
  })

  it('shows loading skeleton', () => {
    const { container } = renderWithProviders(
      <FileBrowser {...defaultProps} isLoading objects={[]} />
    )
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })
})
