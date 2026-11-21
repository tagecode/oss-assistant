import { test, expect } from '@playwright/test'
import { testId } from './helpers/locators'
import { closeApp, launchApp } from './helpers/launch'

test.describe('自绘窗口标题栏', () => {
  test('使用无边框标题栏，并提供最小化、最大化/还原与关闭入口', async () => {
    const { app, window, userDataDir } = await launchApp()

    const windowState = (): Promise<{
      bounds: { x: number; y: number; width: number; height: number }
      content: { x: number; y: number; width: number; height: number }
      maximized: boolean
      minimized: boolean
    }> =>
      app.evaluate(({ BrowserWindow }) => {
        const mainWindow = BrowserWindow.getAllWindows()[0]
        return {
          bounds: mainWindow.getBounds(),
          content: mainWindow.getContentBounds(),
          maximized: mainWindow.isMaximized(),
          minimized: mainWindow.isMinimized()
        }
      })

    try {
      await expect(window.getByTestId(testId.windowTitlebar)).toBeVisible()
      await expect(window.getByTestId(testId.windowControls)).toBeVisible()
      await expect(window.getByTestId(testId.windowMinimize)).toBeVisible()
      await expect(window.getByTestId(testId.windowMaximize)).toBeVisible()
      await expect(window.getByTestId(testId.windowClose)).toBeVisible()

      // 无边框窗口没有系统标题栏，客户区应当和窗口区域完全重合。
      const initial = await windowState()
      expect(initial.bounds).toEqual(initial.content)
      expect(initial.maximized).toBe(false)

      const maximize = window.getByTestId(testId.windowMaximize)
      await maximize.click()
      await expect.poll(async () => (await windowState()).maximized).toBe(true)
      await expect(maximize).toHaveAttribute('data-maximized', 'true')

      await maximize.click()
      await expect.poll(async () => (await windowState()).maximized).toBe(false)
      await expect(maximize).toHaveAttribute('data-maximized', 'false')

      // Windows/Linux 的拖拽区由系统/窗口管理器处理双击最大化，
      // macOS 的无边框窗口由渲染进程补上。
      if (process.platform === 'darwin') {
        const titlebar = await window.getByTestId(testId.windowTitlebar).boundingBox()
        if (!titlebar) throw new Error('窗口标题栏尚未完成布局')
        await window.mouse.dblclick(
          titlebar.x + titlebar.width / 2,
          titlebar.y + titlebar.height / 2
        )
        await expect.poll(async () => (await windowState()).maximized).toBe(true)

        await maximize.click()
        await expect.poll(async () => (await windowState()).maximized).toBe(false)
      }

      await window.getByTestId(testId.windowMinimize).click()
      await expect.poll(async () => (await windowState()).minimized).toBe(true)

      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].restore())
      await expect.poll(async () => (await windowState()).minimized).toBe(false)
    } finally {
      await closeApp(app, userDataDir)
    }
  })
})
