import { app } from 'electron'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { DiagnosticInfo } from '../../shared/types/storage'
import { redactSensitiveText } from './redaction-service'

const LOG_LINE_RE = /^\[([^\]]+)\]/

function parseLogTimestamp(line: string): number | null {
  const match = line.match(LOG_LINE_RE)
  if (!match) return null
  const ts = Date.parse(match[1])
  return Number.isNaN(ts) ? null : ts
}

export class DiagnosticService {
  private logPath: string

  constructor() {
    this.logPath = join(app.getPath('userData'), 'app.log')
  }

  appendLog(message: string): void {
    const redacted = redactSensitiveText(message)
    const line = `[${new Date().toISOString()}] ${redacted}\n`
    try {
      const existing = existsSync(this.logPath) ? readFileSync(this.logPath, 'utf-8') : ''
      writeFileSync(this.logPath, existing + line, 'utf-8')
    } catch {
      // ignore log write failures
    }
  }

  pruneLogs(retentionDays: number): void {
    if (retentionDays <= 0 || !existsSync(this.logPath)) return
    try {
      const raw = readFileSync(this.logPath, 'utf-8')
      const lines = raw.split('\n').filter(Boolean)
      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
      const kept = lines.filter((line) => {
        const ts = parseLogTimestamp(line)
        return ts === null || ts >= cutoff
      })
      const content = kept.length > 0 ? `${kept.join('\n')}\n` : ''
      writeFileSync(this.logPath, content, 'utf-8')
    } catch {
      // ignore prune failures
    }
  }

  getInfo(): DiagnosticInfo {
    let logs: string[] = []
    if (existsSync(this.logPath)) {
      const raw = readFileSync(this.logPath, 'utf-8')
      logs = raw.split('\n').filter(Boolean).slice(-100).map(redactSensitiveText)
    }

    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      platform: process.platform,
      arch: process.arch,
      logs
    }
  }

  export(): string {
    const info = this.getInfo()
    const content = JSON.stringify(info, null, 2)
    const exportDir = app.getPath('downloads')
    if (!existsSync(exportDir)) mkdirSync(exportDir, { recursive: true })
    const exportPath = join(exportDir, `oss-assistant-diagnostic-${Date.now()}.json`)
    writeFileSync(exportPath, content, 'utf-8')
    return exportPath
  }
}
