import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  // CI 上首次失败重试一次：既缓解 runner 抖动，也让下面的 trace: 'on-first-retry'
  // 真正生效（retries 为 0 时 trace 永远不会被录制，失败后无从排查）。
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts'
    }
  ]
})
