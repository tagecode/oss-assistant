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

  test('任务中心状态筛选仅在键盘聚焦时显示焦点环', async () => {
    const { app, window, userDataDir } = await launchApp()

    await window.getByTestId(testId.openTransferCenter).click()
    await expect(window.getByTestId(testId.transferCenter)).toBeVisible()

    const filter = window.getByTestId(testId.transferStatusFilter)
    await filter.click()
    await window.getByTestId('transfer-status-filter-success').click()

    // 鼠标选择后 Select 仍保持焦点，但不应因此常驻绿色焦点环，否则会被误认为“已选中”。
    await expect(filter).toBeFocused()
    expect(await filter.evaluate((element) => element.matches(':focus-visible'))).toBe(false)
    expect(await filter.evaluate((element) => getComputedStyle(element).boxShadow)).not.toMatch(
      /rgb\(34, 197, 94\)/
    )

    // 键盘操作仍然需要保留可见的焦点指示。
    await window.keyboard.press('Shift+Tab')
    await window.keyboard.press('Tab')
    await expect
      .poll(() => filter.evaluate((element) => element.matches(':focus-visible')))
      .toBe(true)
    expect(await filter.evaluate((element) => getComputedStyle(element).boxShadow)).toMatch(
      /rgb\(34, 197, 94\)/
    )

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
