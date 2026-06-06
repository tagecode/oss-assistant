import { test, expect } from '@playwright/test'
import { testId } from './helpers/locators'
import { closeApp, launchApp } from './helpers/launch'

test.describe('OSS 助手启动', () => {
  test('应用窗口可打开并渲染主界面', async () => {
    const { app, window, userDataDir } = await launchApp()

    await expect(window.getByTestId(testId.headerSettings)).toBeVisible({ timeout: 15_000 })

    await closeApp(app, userDataDir)
  })
})
