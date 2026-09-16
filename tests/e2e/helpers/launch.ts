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
  // 无头 Linux（CI runner）没有系统 keyring，safeStorage.isEncryptionAvailable() 为 false，
  // 保存账户时凭证加密直接抛错，表单永远提交不了。这个参数让主进程改用内存密钥。
  // 由 ci-run-e2e.sh 显式开启：本地有桌面会话时仍走真实的系统加密路径。
  // 注意别指望 `--password-store=basic`——Playwright 自己就会加这个开关（见其
  // electron loader），而 basic 后端恰恰是 isEncryptionAvailable() 返回 false 的原因。
  if (process.env.E2E_PLAIN_TEXT_ENCRYPTION === '1') mainArgs.push('--e2e-plain-text-encryption')

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
