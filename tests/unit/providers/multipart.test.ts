import { describe, expect, it, vi } from 'vitest'
import {
  MAX_MULTIPART_PARTS,
  MULTIPART_THRESHOLD_BYTES,
  abortableDelay,
  bytesBeforePart,
  countParts,
  isCheckpointStale,
  isRetryableUploadError,
  partByteRange,
  rejectOnAbort,
  resolvePartSize
} from '../../../src/main/providers/multipart'

describe('multipart helpers', () => {
  it('splits large files into fixed-size parts', () => {
    const partSize = 8 * 1024 * 1024
    expect(MULTIPART_THRESHOLD_BYTES).toBe(partSize)
    expect(countParts(17 * 1024 * 1024, partSize)).toBe(3)
    expect(countParts(0, partSize)).toBe(0)
    expect(bytesBeforePart(17 * 1024 * 1024, partSize, 2)).toBe(partSize)
    expect(bytesBeforePart(17 * 1024 * 1024, partSize, 4)).toBe(17 * 1024 * 1024)
  })

  it('grows the part size so huge files stay under the part limit', () => {
    const partSize = 8 * 1024 * 1024
    expect(resolvePartSize(17 * 1024 * 1024, partSize)).toBe(partSize)
    expect(
      countParts(100 * 1024 ** 3, resolvePartSize(100 * 1024 ** 3, partSize))
    ).toBeLessThanOrEqual(MAX_MULTIPART_PARTS)
    expect(resolvePartSize(1024 ** 3, 4 * 1024 * 1024)).toBe(4 * 1024 * 1024)
  })

  it('returns the byte range of each part including a short final part', () => {
    const partSize = 8 * 1024 * 1024
    const total = 17 * 1024 * 1024
    expect(partByteRange(total, partSize, 1)).toEqual({ start: 0, end: partSize, size: partSize })
    expect(partByteRange(total, partSize, 3)).toEqual({
      start: 16 * 1024 * 1024,
      end: total,
      size: 1024 * 1024
    })
  })

  it('treats a checkpoint as stale when the local file changed', () => {
    const checkpoint = { partSize: 8 * 1024 * 1024, fileSize: 100, fileMtimeMs: 1000 }
    expect(isCheckpointStale(checkpoint, { size: 100, mtimeMs: 1000 } as never)).toBe(false)
    expect(isCheckpointStale(checkpoint, { size: 200, mtimeMs: 1000 } as never)).toBe(true)
    expect(isCheckpointStale(checkpoint, { size: 100, mtimeMs: 5000 } as never)).toBe(true)
    expect(isCheckpointStale({ partSize: 8 * 1024 * 1024 }, { size: 1, mtimeMs: 1 } as never)).toBe(
      false
    )
  })

  it('only retries errors explicitly marked retryable', () => {
    expect(isRetryableUploadError(Object.assign(new Error('429'), { retryable: true }))).toBe(true)
    expect(isRetryableUploadError(new Error('403'))).toBe(false)
    expect(isRetryableUploadError(null)).toBe(false)
  })

  it('stops an abortable delay when the task is cancelled', async () => {
    vi.useFakeTimers()
    try {
      const controller = new AbortController()
      const pending = abortableDelay(5000, controller.signal)
      controller.abort()
      await expect(pending).rejects.toThrow('任务已取消')
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects a raced promise immediately on abort', async () => {
    const controller = new AbortController()
    const raced = rejectOnAbort(new Promise<never>(() => {}), controller.signal)
    controller.abort()
    await expect(raced).rejects.toThrow('任务已取消')
  })
})
