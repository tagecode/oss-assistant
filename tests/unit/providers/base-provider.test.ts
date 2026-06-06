import { describe, expect, it } from 'vitest'
import { calcProgress } from '../../../src/main/providers/base-provider'

describe('calcProgress', () => {
  it('calculates progress percent correctly', () => {
    const result = calcProgress(50, 100, Date.now() - 1000)
    expect(result.progressPercent).toBe(50)
    expect(result.transferredBytes).toBe(50)
    expect(result.totalBytes).toBe(100)
  })

  it('returns zero percent for empty total', () => {
    const result = calcProgress(0, 0, Date.now())
    expect(result.progressPercent).toBe(0)
  })

  it('calculates speed from elapsed time', () => {
    const start = Date.now() - 2000
    const result = calcProgress(1000, 2000, start)
    expect(result.speedBytesPerSecond).toBeGreaterThan(0)
    expect(result.estimatedRemainingSeconds).toBeGreaterThan(0)
  })
})
