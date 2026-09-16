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
    // 无头 Linux runner 没有系统 keyring，safeStorage 不可用，保存账户时凭证加密
    // 直接抛错，账户表单永远提交不了。这里走真实路径：把设置预置进 userData，
    // 主进程启动时读到它就会降级为内存密钥，与用户在设置页勾选完全同一条代码路径。
    // 有 keyring 的环境下这个开关是空操作，不会掩盖真实的加密行为。
    // 复用同一 userDataDir 重启的用例不预置，以免覆盖上一次运行持久化的设置。
    fs.writeFileSync(
      path.join(userDataDir, 'settings.json'),
      JSON.stringify({ allowInsecureCredentialStorage: true }),
      'utf-8'
    )
  }

  const mainArgs = [
    path.join(__dirname, '../../../out/main/index.js'),
    `--user-data-dir=${userDataDir}`
  ]
  if (options?.mockCloud) mainArgs.push('--e2e-mock-cloud')
  // 注意：不要试图用 `--password-store=basic` 解决凭证加密问题。Playwright 自己就会
  // appendSwitch 这个开关（见 playwright-core 的 electron loader），而 basic 后端恰恰是
  // isEncryptionAvailable() 返回 false 的原因。降级只能通过上面的设置项触发。

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
