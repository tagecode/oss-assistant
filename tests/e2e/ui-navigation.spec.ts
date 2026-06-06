import { test, expect } from '@playwright/test'
import { testId } from './helpers/locators'
import { closeApp, launchApp } from './helpers/launch'

test.describe('UI 导航', () => {
  test('空状态可打开添加账户入口', async () => {
    const { app, window, userDataDir } = await launchApp()

    await expect(window.getByTestId(testId.emptyAccounts)).toBeVisible()
    await window.getByTestId(testId.addAccount).click()
    await expect(window.getByTestId(testId.accountForm)).toBeVisible()

    await closeApp(app, userDataDir)
  })

  test('可打开设置与帮助对话框', async () => {
    const { app, window, userDataDir } = await launchApp()

    await window.getByTestId(testId.headerSettings).click()
    await expect(window.getByTestId(testId.settingsDialog)).toBeVisible()

    await window.keyboard.press('Escape')

    await window.getByTestId(testId.headerHelp).click()
    await expect(window.getByTestId(testId.helpDialog)).toBeVisible()

    await closeApp(app, userDataDir)
  })
})
