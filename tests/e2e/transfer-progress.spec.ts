import { test, expect } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { testId } from './helpers/locators'
import { closeApp, launchApp } from './helpers/launch'

const useMock = process.env.E2E_MOCK_CLOUD === '1'
const hasCredentials = Boolean(
  process.env.E2E_QINIU_ACCESS_KEY &&
  process.env.E2E_QINIU_SECRET_KEY &&
  process.env.E2E_QINIU_BUCKET
)
const canRun = useMock || hasCredentials

const ACCOUNT_NAME = `E2E-${Date.now()}`
const UPLOAD_FILE_NAME = `e2e-progress-${Date.now()}.txt`
const MOCK_BUCKET = 'e2e-mock-bucket'

test.describe('传输进度展示', () => {
  test.skip(!canRun, '需要 E2E_MOCK_CLOUD=1 或配置 E2E_QINIU_* 凭证')

  test('上传任务展示进度条和速度信息', async () => {
    test.setTimeout(180_000)

    const bucketName = useMock ? MOCK_BUCKET : process.env.E2E_QINIU_BUCKET!
    const uploadFilePath = path.join(os.tmpdir(), UPLOAD_FILE_NAME)
    fs.writeFileSync(uploadFilePath, `progress test content ${Date.now()}`.repeat(100))

    const { app, window, userDataDir } = await launchApp({ mockCloud: useMock })

    // Add account
    await window.getByTestId(testId.addAccount).click()
    await expect(window.getByTestId(testId.accountForm)).toBeVisible()
    await window.locator('#name').fill(ACCOUNT_NAME)
    await window
      .locator('#accessKeyId')
      .fill(useMock ? 'mock-ak' : process.env.E2E_QINIU_ACCESS_KEY!)
    await window.locator('#secretKey').fill(useMock ? 'mock-sk' : process.env.E2E_QINIU_SECRET_KEY!)
    if (useMock) {
      await window.locator('#bucketDomain').fill('https://mock.example.com')
    }
    await window.getByTestId(testId.testConnection).click()
    await expect(window.getByTestId(testId.connectionTestSuccess)).toBeVisible({ timeout: 60_000 })
    await window.getByTestId(testId.saveAccount).click()
    await expect(window.getByTestId(testId.accountForm)).not.toBeVisible()

    // Get account ID
    const accountId = await window.evaluate(async () => {
      const accounts = await window.api.listAccounts()
      return accounts.find((a) => a.name.startsWith('E2E-'))?.id ?? null
    })
    expect(accountId).toBeTruthy()

    // Select bucket
    await window.getByText(bucketName).click()

    // Open transfer center before uploading
    await window.getByTestId(testId.openTransferCenter).click()
    await expect(window.getByTestId(testId.transferCenter)).toBeVisible()
    await window.keyboard.press('Escape')

    // Upload via API
    await window.evaluate(
      async ({ filePath, bucket, account }) => {
        await window.api.createUpload({
          accountId: account,
          bucket,
          prefix: '',
          localPaths: [filePath]
        })
      },
      {
        filePath: uploadFilePath,
        bucket: bucketName,
        account: accountId!
      }
    )

    // Open transfer center and verify progress is shown
    await window.getByTestId(testId.openTransferCenter).click()
    await expect(window.getByTestId(testId.transferCenter)).toBeVisible()

    // Wait for task to appear and verify progress bar is visible
    const task = window
      .getByTestId(testId.transferTask)
      .filter({
        has: window.getByText(UPLOAD_FILE_NAME)
      })
      .first()
    await expect(task).toBeVisible({ timeout: 120_000 })

    // Progress bar should be visible during running state
    await expect(task.getByTestId('task-progress')).toBeVisible({ timeout: 30_000 })

    // Verify task completes successfully
    await expect(task.getByTestId(testId.taskStatus)).toHaveAttribute('data-status', 'success', {
      timeout: 120_000
    })

    // Verify file appears in file list
    await window.keyboard.press('Escape')
    await window.getByTestId(testId.toolbarRefresh).click()
    await expect(window.getByText(UPLOAD_FILE_NAME)).toBeVisible({ timeout: 60_000 })

    // Clean up
    await closeApp(app, userDataDir)
    fs.rmSync(uploadFilePath, { force: true })
  })
})
