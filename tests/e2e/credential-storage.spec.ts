import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { testId } from './helpers/locators'
import { closeApp, launchApp } from './helpers/launch'
import { addMockAccount } from './helpers/cloud'

/**
 * 无系统密钥环（CI 的 headless Linux）时，用户必须能在设置页显式启用内存密钥，
 * 之后账户才能保存，并且重启后仍能解密。有 keyring 的机器上系统加密直接可用，
 * 设置页不会渲染这个开关，用例会自动跳过。
 */
test.describe('凭证存储降级', () => {
  test.skip(process.env.E2E_MOCK_CLOUD !== '1', '账户表单使用 Mock Provider，需要 E2E_MOCK_CLOUD=1')

  test('无密钥环时在设置页启用内存密钥，账户可保存且重启后可用', async () => {
    test.setTimeout(180_000)

    const accountName = `E2E-credential-${Date.now()}`
    const { app, window, userDataDir } = await launchApp({ seedCredentialFallback: false })

    const status = await window.evaluate(() => window.api.getCredentialStorageStatus())
    if (status.encryptionAvailable) {
      await closeApp(app, userDataDir)
      test.skip(true, '当前环境有系统密钥环，内存密钥降级开关不会显示')
    }

    // 未启用降级前设置页应给出警告，开关默认关闭。
    await window.getByTestId(testId.headerSettings).click()
    await expect(window.getByTestId(testId.settingsDialog)).toBeVisible()
    await expect(window.getByTestId(testId.credentialWarning)).toBeVisible()
    const toggle = window.getByTestId(testId.settingsAllowInsecureCredentials)
    await expect(toggle).toHaveAttribute('data-state', 'unchecked')

    await toggle.click()
    await expect
      .poll(
        () =>
          window.evaluate(
            async () => (await window.api.getSettings()).allowInsecureCredentialStorage
          ),
        { timeout: 10_000 }
      )
      .toBe(true)
    await expect
      .poll(
        () =>
          window.evaluate(
            async () => (await window.api.getCredentialStorageStatus()).fallbackEnabled
          ),
        { timeout: 10_000 }
      )
      .toBe(true)
    await window.keyboard.press('Escape')

    // 通过真实表单保存账户；若降级未生效，credentialService.encrypt 会直接抛错。
    const accountId = await addMockAccount(window, accountName)

    const vault = fs.readFileSync(path.join(userDataDir, 'credentials', 'vault.json'), 'utf-8')
    expect(vault).not.toContain('mock-ak')
    expect(vault).not.toContain('mock-sk')

    // 重启后设置持久化，且账户凭证仍能解密（testConnection 会走 resolveForConnection）。
    await app.close()
    const relaunched = await launchApp({ userDataDir })
    const relaunchStatus = await relaunched.window.evaluate(() =>
      window.api.getCredentialStorageStatus()
    )
    expect(relaunchStatus.encryptionAvailable).toBe(false)
    expect(relaunchStatus.fallbackEnabled).toBe(true)
    await expect
      .poll(
        () =>
          relaunched.window.evaluate(
            async () => (await window.api.getSettings()).allowInsecureCredentialStorage
          ),
        { timeout: 10_000 }
      )
      .toBe(true)
    await relaunched.window.evaluate(async (id) => window.api.testConnection({}, id), accountId)

    await closeApp(relaunched.app, userDataDir)
  })
})
