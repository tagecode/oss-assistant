import { test, expect } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { testId, waitForTransferSuccess } from './helpers/locators'
import { closeApp, launchApp } from './helpers/launch'

const useMock = process.env.E2E_MOCK_CLOUD === '1'
const hasCredentials = Boolean(
  process.env.E2E_QINIU_ACCESS_KEY &&
  process.env.E2E_QINIU_SECRET_KEY &&
  process.env.E2E_QINIU_BUCKET
)
const canRun = useMock || hasCredentials

const ACCOUNT_NAME = `E2E-${Date.now()}`
const UPLOAD_FILE_NAME = `e2e-upload-${Date.now()}.txt`
const MOCK_BUCKET = 'e2e-mock-bucket'

test.describe('云存储关键路径', () => {
  test.skip(!canRun, '需要 E2E_MOCK_CLOUD=1 或配置 E2E_QINIU_* 凭证')

  test('添加账户 → 上传 → 下载 → 删除', async () => {
    test.setTimeout(180_000)

    const bucketName = useMock ? MOCK_BUCKET : process.env.E2E_QINIU_BUCKET!
    const uploadFilePath = path.join(os.tmpdir(), UPLOAD_FILE_NAME)
    fs.writeFileSync(uploadFilePath, `e2e content ${Date.now()}`)

    const { app, window, userDataDir } = await launchApp({ mockCloud: useMock })

    await window.getByTestId(testId.addAccount).click()
    await expect(window.getByTestId(testId.accountForm)).toBeVisible()
    await window.locator('#name').fill(ACCOUNT_NAME)
    await window
      .locator('#accessKeyId')
      .fill(useMock ? 'mock-ak' : process.env.E2E_QINIU_ACCESS_KEY!)
    await window.locator('#secretKey').fill(useMock ? 'mock-sk' : process.env.E2E_QINIU_SECRET_KEY!)
    if (useMock) {
      await window.locator('#bucketDomain').fill('https://mock.example.com')
    } else if (process.env.E2E_QINIU_REGION) {
      await window.locator('#region').click()
      await window.getByRole('option', { name: process.env.E2E_QINIU_REGION }).click()
    }
    await window.getByTestId(testId.testConnection).click()
    await expect(window.getByTestId(testId.connectionTestSuccess)).toBeVisible({ timeout: 60_000 })
    await window.getByTestId(testId.saveAccount).click()
    await expect(window.getByTestId(testId.accountForm)).not.toBeVisible()

    const accountId = await window.evaluate(async () => {
      const accounts = await window.api.listAccounts()
      return accounts.find((a) => a.name.startsWith('E2E-'))?.id ?? null
    })
    expect(accountId).toBeTruthy()

    await window.getByText(bucketName).click()

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

    await waitForTransferSuccess(window, UPLOAD_FILE_NAME)
    await window.getByTestId(testId.toolbarRefresh).click()
    await expect(window.getByText(UPLOAD_FILE_NAME)).toBeVisible({ timeout: 60_000 })

    const row = window
      .getByText(UPLOAD_FILE_NAME)
      .locator('xpath=ancestor::div[contains(@class,"cursor-pointer")]')
      .first()
    await row.getByRole('checkbox').check()

    const downloadDir = path.join(os.tmpdir(), `e2e-download-${Date.now()}`)
    fs.mkdirSync(downloadDir, { recursive: true })

    await window.evaluate(
      async ({ account, bucket, key, localDir }) => {
        const items = await window.api.resolveDownloadPaths(localDir, [key])
        await window.api.createDownload({ accountId: account, bucket, items })
      },
      {
        account: accountId!,
        bucket: bucketName,
        key: UPLOAD_FILE_NAME,
        localDir: downloadDir
      }
    )

    await waitForTransferSuccess(window, UPLOAD_FILE_NAME)
    expect(fs.existsSync(path.join(downloadDir, UPLOAD_FILE_NAME))).toBe(true)

    await row.getByRole('checkbox').check()
    await window.getByTestId(testId.toolbarDelete).click()
    await window.getByTestId(testId.confirmDeleteObjects).click()
    await waitForTransferSuccess(window, UPLOAD_FILE_NAME)

    await window.getByTestId(testId.toolbarRefresh).click()
    await expect(window.getByText(UPLOAD_FILE_NAME)).not.toBeVisible({ timeout: 60_000 })

    await closeApp(app, userDataDir)
    fs.rmSync(uploadFilePath, { force: true })
    fs.rmSync(downloadDir, { recursive: true, force: true })
  })
})
