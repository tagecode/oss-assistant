import { test, expect } from '@playwright/test'
import fs from 'fs'
import { testId } from './helpers/locators'
import { closeApp, launchApp } from './helpers/launch'

test.describe('设置与诊断', () => {
  test('可保存设置并导出脱敏诊断日志', async () => {
    const { app, window, userDataDir } = await launchApp()

    await window.getByTestId(testId.headerSettings).click()
    await expect(window.getByTestId(testId.settingsDialog)).toBeVisible()

    const retention = window.getByTestId(testId.settingsLogRetention)
    await retention.fill('14')
    await window.waitForFunction(
      async () => (await window.api.getSettings()).logRetentionDays === 14
    )

    const autoUpdate = window.getByTestId(testId.settingsAutoUpdate)
    if ((await autoUpdate.getAttribute('data-state')) === 'checked') {
      await autoUpdate.click()
      await window.waitForFunction(
        async () => (await window.api.getSettings()).autoCheckUpdate === false
      )
    }

    const saved = await window.evaluate(async () => window.api.getSettings())
    expect(saved.logRetentionDays).toBe(14)
    expect(saved.autoCheckUpdate).toBe(false)

    await window.keyboard.press('Escape')

    await window.getByTestId(testId.headerHelp).click()
    await expect(window.getByTestId(testId.helpDialog)).toBeVisible()

    const exportPath = await window.evaluate(async () => window.api.exportDiagnostics())

    expect(fs.existsSync(exportPath)).toBe(true)
    const content = fs.readFileSync(exportPath, 'utf-8')
    expect(content).not.toMatch(/secretKey|accessKeySecret|AKIA[0-9A-Z]{16}/i)
    expect(content).toContain('appVersion')

    fs.rmSync(exportPath, { force: true })
    await closeApp(app, userDataDir)
  })

  test('设置保存后重启应用仍生效', async () => {
    const { app, window, userDataDir } = await launchApp()

    await window.getByTestId(testId.headerSettings).click()
    await expect(window.getByTestId(testId.settingsDialog)).toBeVisible()

    await window.getByTestId(testId.settingsLogRetention).fill('21')
    await window.waitForFunction(
      async () => (await window.api.getSettings()).logRetentionDays === 21
    )

    const autoUpdate = window.getByTestId(testId.settingsAutoUpdate)
    if ((await autoUpdate.getAttribute('data-state')) !== 'checked') {
      await autoUpdate.click()
      await window.waitForFunction(
        async () => (await window.api.getSettings()).autoCheckUpdate === true
      )
    }

    await window.keyboard.press('Escape')
    await app.close()

    const { app: relaunched, window: relaunchedWindow } = await launchApp({ userDataDir })
    const persisted = await relaunchedWindow.evaluate(async () => window.api.getSettings())

    expect(persisted.logRetentionDays).toBe(21)
    expect(persisted.autoCheckUpdate).toBe(true)

    await closeApp(relaunched, userDataDir)
  })
})
