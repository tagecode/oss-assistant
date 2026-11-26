import { expect, test } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { addMockAccount, selectMockBucket, waitForTransferStatus } from './helpers/cloud'
import { testId } from './helpers/locators'
import { closeApp, launchApp } from './helpers/launch'

test.describe('账户与文件夹管理', () => {
  test.skip(process.env.E2E_MOCK_CLOUD !== '1', '需要 E2E_MOCK_CLOUD=1')

  test('文件夹导航、对象属性、账户编辑与删除', async () => {
    test.setTimeout(180_000)

    const accountName = `E2E-account-${Date.now()}`
    const folderFile = `e2e-folder-${Date.now()}.txt`
    const localFile = path.join(os.tmpdir(), folderFile)
    fs.writeFileSync(localFile, `folder content ${Date.now()}`)

    const { app, window, userDataDir } = await launchApp({ mockCloud: true })

    try {
      const accountId = await addMockAccount(window, accountName)
      await selectMockBucket(window)

      await window.evaluate(
        async ({ account, filePath }) => {
          await window.api.createUpload({
            accountId: account,
            bucket: 'e2e-mock-bucket',
            prefix: 'folder/',
            localPaths: [filePath]
          })
        },
        { account: accountId, filePath: localFile }
      )
      await waitForTransferStatus(window, `folder/${folderFile}`, 'success')
      await window.getByTestId(testId.toolbarRefresh).click()

      const folderRow = window
        .getByText('folder', { exact: true })
        .locator('xpath=ancestor::div[contains(@class,"cursor-pointer")]')
        .first()
      await expect(folderRow).toBeVisible({ timeout: 30_000 })
      await folderRow.dblclick()

      const fileRow = window.getByTestId('file-row').filter({ hasText: folderFile }).first()
      await expect(fileRow).toBeVisible({ timeout: 30_000 })

      await fileRow.click({ button: 'right' })
      await window.getByTestId(testId.viewProperties).click()
      const properties = window.getByTestId(testId.objectPropertiesDialog)
      await expect(properties).toBeVisible()
      await expect(properties).toContainText(folderFile)
      await expect(properties).toContainText(`folder/${folderFile}`)
      await window.keyboard.press('Escape')
      await expect(properties).not.toBeVisible()

      const editedName = `${accountName}-edited`
      const accountRow = window
        .getByTestId(testId.accountRow)
        .filter({ hasText: accountName })
        .first()
      await accountRow.hover()
      await accountRow.getByTestId(testId.accountMenu).click()
      await window.getByTestId(testId.editAccount).click()
      await expect(window.getByTestId(testId.accountForm)).toBeVisible()
      await window.locator('#name').fill(editedName)
      await window.getByTestId(testId.saveAccount).click()
      await expect(window.getByTestId(testId.accountForm)).not.toBeVisible()
      await expect(
        window.getByTestId(testId.accountRow).filter({ hasText: editedName })
      ).toBeVisible()

      const editedRow = window
        .getByTestId(testId.accountRow)
        .filter({ hasText: editedName })
        .first()
      await editedRow.hover()
      await editedRow.getByTestId(testId.accountMenu).click()
      await window.getByTestId(testId.deleteAccount).click()
      await window.getByTestId(testId.confirmDeleteAccount).click()
      await expect(window.getByTestId(testId.emptyAccounts)).toBeVisible()
    } finally {
      await closeApp(app, userDataDir)
      fs.rmSync(localFile, { force: true })
    }
  })
})
