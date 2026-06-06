import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterAll, vi } from 'vitest'

export const testUserData = mkdtempSync(join(tmpdir(), 'oss-assistant-test-'))
const testDownloads = join(testUserData, 'downloads')
if (!existsSync(testDownloads)) mkdirSync(testDownloads, { recursive: true })

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'downloads') return join(testUserData, 'downloads')
      return testUserData
    }),
    getVersion: vi.fn(() => '1.0.0')
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf-8')),
    decryptString: vi.fn((buffer: Buffer) => buffer.toString('utf-8'))
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

afterAll(() => {
  rmSync(testUserData, { recursive: true, force: true })
})
