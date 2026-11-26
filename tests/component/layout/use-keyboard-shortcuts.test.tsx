import { fireEvent, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'

function renderShortcuts(overrides: Partial<Parameters<typeof useKeyboardShortcuts>[0]> = {}): {
  handlers: {
    onUpload: ReturnType<typeof vi.fn>
    onDownload: ReturnType<typeof vi.fn>
    onDelete: ReturnType<typeof vi.fn>
    onRefresh: ReturnType<typeof vi.fn>
  }
  unmount: () => void
} {
  const handlers = {
    onUpload: vi.fn(),
    onDownload: vi.fn(),
    onDelete: vi.fn(),
    onRefresh: vi.fn()
  }
  const { unmount } = renderHook(() =>
    useKeyboardShortcuts({
      ...handlers,
      ...overrides
    })
  )
  return { handlers, unmount }
}

describe('useKeyboardShortcuts', () => {
  it('maps Ctrl/Cmd+U to upload', () => {
    const { handlers } = renderShortcuts()

    fireEvent.keyDown(window, { key: 'u', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'U', metaKey: true })

    expect(handlers.onUpload).toHaveBeenCalledTimes(2)
  })

  it('passes Shift to the download handler', () => {
    const { handlers } = renderShortcuts()

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'd', metaKey: true, shiftKey: true })

    expect(handlers.onDownload).toHaveBeenNthCalledWith(1, false)
    expect(handlers.onDownload).toHaveBeenNthCalledWith(2, true)
  })

  it('maps Delete and F5 to delete and refresh', () => {
    const { handlers } = renderShortcuts()

    fireEvent.keyDown(window, { key: 'Delete' })
    fireEvent.keyDown(window, { key: 'F5' })

    expect(handlers.onDelete).toHaveBeenCalledOnce()
    expect(handlers.onRefresh).toHaveBeenCalledOnce()
  })

  it('prevents the browser default for handled keys', () => {
    renderShortcuts()

    const event = new KeyboardEvent('keydown', {
      key: 'u',
      ctrlKey: true,
      cancelable: true
    })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('does nothing while disabled', () => {
    const { handlers } = renderShortcuts({ enabled: false })

    fireEvent.keyDown(window, { key: 'u', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'Delete' })
    fireEvent.keyDown(window, { key: 'F5' })

    expect(handlers.onUpload).not.toHaveBeenCalled()
    expect(handlers.onDelete).not.toHaveBeenCalled()
    expect(handlers.onRefresh).not.toHaveBeenCalled()
  })

  it('removes the listener on unmount', () => {
    const { handlers, unmount } = renderShortcuts()
    unmount()

    fireEvent.keyDown(window, { key: 'u', ctrlKey: true })

    expect(handlers.onUpload).not.toHaveBeenCalled()
  })
})
