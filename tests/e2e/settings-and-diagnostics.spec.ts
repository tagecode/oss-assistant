import { test, expect, type Locator } from '@playwright/test'
import fs from 'fs'
import { testId } from './helpers/locators'
import { closeApp, launchApp } from './helpers/launch'

test.describe('设置与诊断', () => {
  test('可保存设置并导出脱敏诊断日志', async () => {
    const { app, window, userDataDir } = await launchApp()

    await window.getByTestId(testId.headerSettings).click()
    const dialog = window.getByTestId(testId.settingsDialog)
    await expect(dialog).toBeVisible()

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

    // 自绘标题栏的拖拽区会盖住弹窗顶部；弹窗必须声明 no-drag，
    // 否则真实鼠标点击右上角关闭按钮会被窗口拖拽命中测试吞掉。
    expect(
      await dialog.evaluate((element) =>
        getComputedStyle(element).getPropertyValue('-webkit-app-region')
      )
    ).toBe('no-drag')
    await window.getByTestId(testId.dialogClose).click()
    await expect(dialog).toBeHidden()

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

  test('弹窗输入框的焦点环不被滚动容器裁切', async () => {
    const { app, window, userDataDir } = await launchApp()

    const measureFocusRing = (
      input: Locator
    ): Promise<{ leftGap: number; rightGap: number; boxShadow: string }> =>
      input.evaluate((element) => {
        const scroll = element.closest('[data-dialog-scroll]')
        if (!scroll) throw new Error('输入框不在弹窗滚动容器内')
        const inputBox = element.getBoundingClientRect()
        const scrollBox = scroll.getBoundingClientRect()
        return {
          leftGap: inputBox.left - scrollBox.left,
          rightGap: scrollBox.right - inputBox.right,
          boxShadow: getComputedStyle(element).boxShadow
        }
      })

    // 设置弹窗：默认下载路径、日志保留天数等输入框都是整行宽度，最容易贴住滚动容器边缘。
    await window.getByTestId(testId.headerSettings).click()
    const retention = window.getByTestId(testId.settingsLogRetention)
    await retention.focus()
    const settingsRing = await measureFocusRing(retention)
    expect(settingsRing.boxShadow).toMatch(/rgb\(34, 197, 94\)/)
    expect(settingsRing.leftGap).toBeGreaterThanOrEqual(2)
    expect(settingsRing.rightGap).toBeGreaterThanOrEqual(2)

    await window.getByTestId(testId.dialogClose).click()

    // 账户弹窗同样使用 DialogContent，应共享同一个修复。
    await window.getByTestId(testId.addAccount).click()
    const name = window.locator('#name')
    await expect(name).toBeVisible()
    await name.focus()
    const accountRing = await measureFocusRing(name)
    expect(accountRing.boxShadow).toMatch(/rgb\(34, 197, 94\)/)
    expect(accountRing.leftGap).toBeGreaterThanOrEqual(2)
    expect(accountRing.rightGap).toBeGreaterThanOrEqual(2)

    await closeApp(app, userDataDir)
  })

  test('窗口高度不足时设置弹窗自适应并滚动正文', async () => {
    const { app, window, userDataDir } = await launchApp()

    // 应用最小窗口高度为 600，视口会更矮；设置项较多时必须完整落在视口内。
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(1024, 600)
    })
    await expect.poll(() => window.evaluate(() => window.innerHeight)).toBeLessThan(620)

    await window.getByTestId(testId.headerSettings).click()
    const dialog = window.getByTestId(testId.settingsDialog)
    await expect(dialog).toBeVisible()

    const viewport = await window.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }))
    await expect
      .poll(
        async () => {
          const box = await dialog.boundingBox()
          if (!box) return false
          return (
            box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= viewport.width + 1 &&
            box.y + box.height <= viewport.height + 1
          )
        },
        { message: '设置弹窗应完整位于视口内' }
      )
      .toBe(true)

    const scroll = dialog.locator('[data-dialog-scroll]')
    const metrics = await scroll.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight
    }))
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)

    // 标题区固定在滚动区域之外，滚动条的起点必须在关闭按钮下方，不能穿过标题栏。
    const closeBox = await window.getByTestId(testId.dialogClose).boundingBox()
    const scrollBox = await scroll.boundingBox()
    if (!closeBox || !scrollBox) throw new Error('无法测量弹窗关闭按钮或滚动容器')
    expect(scrollBox.y).toBeGreaterThanOrEqual(closeBox.y + closeBox.height)

    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect(dialog.getByRole('heading', { name: '设置' })).toBeVisible()
    await expect(dialog.getByText(/v\d+\.\d+\.\d+/)).toBeVisible()

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
