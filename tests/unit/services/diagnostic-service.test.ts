import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it } from 'vitest'
import { testUserData } from '../../setup'
import { DiagnosticService } from '../../../src/main/services/diagnostic-service'

describe('DiagnosticService', () => {
  const logPath = join(testUserData, 'app.log')

  beforeEach(() => {
    if (existsSync(logPath)) rmSync(logPath)
  })

  it('appends redacted log lines', () => {
    const service = new DiagnosticService()
    service.appendLog('secretKey=abcdefghijklmnop')
    const raw = readFileSync(logPath, 'utf-8')
    expect(raw).not.toContain('abcdefghijklmnop')
    expect(raw).toContain('***')
  })

  it('returns diagnostic info without secrets', () => {
    const service = new DiagnosticService()
    service.appendLog('error secret=MySecretKey12345')
    const info = service.getInfo()
    expect(info.appVersion).toBe('1.0.0')
    expect(info.logs.length).toBeGreaterThan(0)
    const serialized = JSON.stringify(info)
    expect(serialized).not.toContain('MySecretKey12345')
  })

  it('exports redacted json to downloads', () => {
    const service = new DiagnosticService()
    service.appendLog('accessKeySecret=should-not-leak')
    const exportPath = service.export()
    expect(existsSync(exportPath)).toBe(true)
    const content = readFileSync(exportPath, 'utf-8')
    expect(content).not.toContain('should-not-leak')
    expect(content).toContain('appVersion')
    rmSync(exportPath, { force: true })
  })

  it('prunes logs older than retention days', () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    const recentDate = new Date().toISOString()
    writeFileSync(logPath, `[${oldDate}] old line\n[${recentDate}] recent line\n`, 'utf-8')

    const service = new DiagnosticService()
    service.pruneLogs(30)

    const raw = readFileSync(logPath, 'utf-8')
    expect(raw).not.toContain('old line')
    expect(raw).toContain('recent line')
  })
})
