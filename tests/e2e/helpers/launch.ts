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
  // 无头 Linux（CI runner）没有系统 keyring，Electron 的
  // safeStorage.isEncryptionAvailable() 会返回 false，保存账户时凭证加密直接抛错，
  // 表单永远提交不了。basic password store 让 Chromium 改用内置密钥后端，
  // 流程才跑得下去。只影响测试进程——生产构建不传这个参数。
  if (process.platform === 'linux') mainArgs.push('--password-store=basic')

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
