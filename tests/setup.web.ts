import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

globalThis.ResizeObserver = class ResizeObserver {
  observe(): void {
    /* jsdom polyfill */
  }
  unobserve(): void {
    /* jsdom polyfill */
  }
  disconnect(): void {
    /* jsdom polyfill */
  }
} as typeof ResizeObserver

const defaultSettings = {
  theme: 'system' as const,
  language: 'zh' as const,
  defaultDownloadPath: '/tmp/downloads',
  transferConcurrency: 3,
  logRetentionDays: 30,
  autoCheckUpdate: true
}

Object.defineProperty(window, 'api', {
  configurable: true,
  value: {
    getSettings: vi.fn().mockResolvedValue(defaultSettings),
    updateSettings: vi.fn().mockResolvedValue(defaultSettings),
    getVersion: vi.fn().mockResolvedValue('1.0.0'),
    getPlatform: vi.fn().mockResolvedValue('win32'),
    pathsExist: vi.fn().mockResolvedValue([]),
    resolveDownloadPaths: vi.fn().mockResolvedValue([]),
    uniqueDownloadPath: vi.fn().mockResolvedValue('/tmp/downloads/file (1).txt'),
    createDownload: vi.fn().mockResolvedValue([]),
    createUpload: vi.fn().mockResolvedValue([]),
    selectFiles: vi.fn().mockResolvedValue([]),
    selectDirectory: vi.fn().mockResolvedValue('/tmp/downloads'),
    getPathForFile: vi.fn().mockReturnValue('/tmp/file.txt')
  }
})
