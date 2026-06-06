import { _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

export async function launchApp(options?: {
  mockCloud?: boolean
  userDataDir?: string
}): Promise<{ app: ElectronApplication; window: Page; userDataDir: string }> {
  const userDataDir =
    options?.userDataDir ??
    path.join(os.tmpdir(), `oss-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  if (!options?.userDataDir) {
    fs.mkdirSync(userDataDir, { recursive: true })
  }

  const mainArgs = [
    path.join(__dirname, '../../../out/main/index.js'),
    `--user-data-dir=${userDataDir}`
  ]
  if (options?.mockCloud) mainArgs.push('--e2e-mock-cloud')

  const app = await electron.launch({
    args: mainArgs,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ...(options?.mockCloud ? { E2E_MOCK_CLOUD: '1' } : {})
    }
  })

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  return { app, window, userDataDir }
}

export async function closeApp(app: ElectronApplication, userDataDir: string): Promise<void> {
  await app.close()
  fs.rmSync(userDataDir, { recursive: true, force: true })
}
