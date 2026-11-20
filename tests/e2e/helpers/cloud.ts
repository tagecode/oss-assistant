import { expect, type Page } from '@playwright/test'
import { testId } from './locators'

export const MOCK_BUCKET = 'e2e-mock-bucket'

/** 通过账户表单创建 Mock 账户，返回主进程生成的真实账户 id。 */
export async function addMockAccount(window: Page, accountName: string): Promise<string> {
  await window.getByTestId(testId.addAccount).click()
  await expect(window.getByTestId(testId.accountForm)).toBeVisible()
  await window.locator('#name').fill(accountName)
  await window.locator('#accessKeyId').fill('mock-ak')
  await window.locator('#secretKey').fill('mock-sk')
  await window.locator('#bucketDomain').fill('https://mock.example.com')
  await window.getByTestId(testId.testConnection).click()
  await expect(window.getByTestId(testId.connectionTestSuccess)).toBeVisible({ timeout: 60_000 })
  await window.getByTestId(testId.saveAccount).click()
  await expect(window.getByTestId(testId.accountForm)).not.toBeVisible()

  const accountId = await window.evaluate(async (name) => {
    const accounts = await window.api.listAccounts()
    return accounts.find((account) => account.name === name)?.id ?? null
  }, accountName)
  expect(accountId, `账户 ${accountName} 应已保存`).toBeTruthy()
  return accountId!
}

/** 选中 Mock Provider 唯一返回的桶，随后上传/刷新都作用在该桶上。 */
export async function selectMockBucket(window: Page): Promise<void> {
  const bucket = window.getByText(MOCK_BUCKET).first()
  await expect(bucket).toBeVisible({ timeout: 30_000 })
  await bucket.click()
}

export async function listTransferStatus(window: Page, objectKey: string): Promise<string | null> {
  return window.evaluate(async (key) => {
    const tasks = await window.api.listTransfers()
    return tasks.find((task) => task.objectKey === key)?.status ?? null
  }, objectKey)
}

/** 轮询传输任务状态，避免依赖任务中心是否打开。 */
export async function waitForTransferStatus(
  window: Page,
  objectKey: string,
  status: string,
  timeout = 120_000
): Promise<void> {
  await expect.poll(() => listTransferStatus(window, objectKey), { timeout }).toBe(status)
}
