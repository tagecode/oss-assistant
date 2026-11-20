import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { testId } from './helpers/locators'
import { closeApp, launchApp } from './helpers/launch'
import {
  addMockAccount,
  MOCK_BUCKET,
  selectMockBucket,
  waitForTransferStatus
} from './helpers/cloud'

// 分片/断点/可重试错误的断言依赖 Mock Provider 的确定性行为；真实七牛凭证
// 下 9MB 文件会真的走网络，无法在这里稳定注入瞬时错误。
const useMock = process.env.E2E_MOCK_CLOUD === '1'
const MB = 1024 * 1024

function createFile(name: string, size: number): string {
  const filePath = path.join(os.tmpdir(), name)
  fs.writeFileSync(filePath, Buffer.alloc(size))
  return filePath
}

async function uploadAndWait(
  window: Page,
  accountId: string,
  filePath: string,
  expectedStatus: string
): Promise<void> {
  const key = path.basename(filePath)
  await window.evaluate(
    async ({ account, bucket, localPath }) => {
      await window.api.createUpload({
        accountId: account,
        bucket,
        prefix: '',
        localPaths: [localPath]
      })
    },
    { account: accountId, bucket: MOCK_BUCKET, localPath: filePath }
  )
  await waitForTransferStatus(window, key, expectedStatus)
}

test.describe('大文件分片上传', () => {
  test.skip(!useMock, '需要 E2E_MOCK_CLOUD=1 才能确定性地模拟分片、断点与瞬时错误')

  test('分片上传遇到可重试错误后从断点续传成功', async () => {
    test.setTimeout(180_000)

    // 17MB → 3 个 8MB 分片；文件名触发 Mock 在第 1 片后抛一次 retryable 错误。
    // 第二次尝试若拿不到带 part 1 的 checkpoint，Mock 会直接失败，因此这个用例
    // 同时守住「自动重试」和「重试复用检查点」两条行为。
    const fileName = `e2e-retryable-${Date.now()}.bin`
    const fileSize = 17 * MB
    const filePath = createFile(fileName, fileSize)

    const { app, window, userDataDir } = await launchApp()
    const accountId = await addMockAccount(window, `E2E-multipart-${Date.now()}`)
    await selectMockBucket(window)

    await uploadAndWait(window, accountId, filePath, 'success')

    const object = await window.evaluate(
      async ({ account, bucket, key }) => {
        const result = await window.api.listObjects(account, bucket)
        return result.objects.find((item) => item.key === key) ?? null
      },
      { account: accountId, bucket: MOCK_BUCKET, key: fileName }
    )
    expect(object?.size).toBe(fileSize)

    await closeApp(app, userDataDir)
    fs.rmSync(filePath, { force: true })
  })

  test('取消进行中的分片上传，任务立即终止且不产生对象', async () => {
    test.setTimeout(180_000)

    // 40MB → 5 个分片；放大分片间隔，保证点取消时上传仍在进行。
    const fileName = `e2e-cancel-${Date.now()}.bin`
    const filePath = createFile(fileName, 40 * MB)

    const { app, window, userDataDir } = await launchApp({
      env: { E2E_MOCK_PART_DELAY_MS: '700' }
    })
    const accountId = await addMockAccount(window, `E2E-cancel-${Date.now()}`)
    await selectMockBucket(window)

    await window.evaluate(
      async ({ account, bucket, localPath }) => {
        await window.api.createUpload({
          accountId: account,
          bucket,
          prefix: '',
          localPaths: [localPath]
        })
      },
      { account: accountId, bucket: MOCK_BUCKET, localPath: filePath }
    )

    await window.keyboard.press('Escape')
    await window.getByTestId(testId.openTransferCenter).click({ force: true })
    await expect(window.getByTestId(testId.transferCenter)).toBeVisible()

    const task = window.getByTestId(testId.transferTask).filter({ hasText: fileName }).first()
    await expect(task).toBeVisible({ timeout: 30_000 })
    await expect(task.getByTestId(testId.taskProgress)).toBeVisible({ timeout: 30_000 })

    await task.getByTestId(testId.cancelTransfer).click()
    await expect(task.getByTestId(testId.taskStatus)).toHaveAttribute('data-status', 'cancelled', {
      timeout: 30_000
    })

    // 取消后 provider 不应把对象写入远端。
    await window.waitForTimeout(1_000)
    const exists = await window.evaluate(
      async ({ account, bucket, key }) => {
        const result = await window.api.listObjects(account, bucket)
        return result.objects.some((item) => item.key === key)
      },
      { account: accountId, bucket: MOCK_BUCKET, key: fileName }
    )
    expect(exists).toBe(false)

    await closeApp(app, userDataDir)
    fs.rmSync(filePath, { force: true })
  })

  test('失败任务手动重试时复用断点并成功', async () => {
    test.setTimeout(180_000)

    // 文件名触发 Mock 在第 1 片后抛不可重试错误：自动重试不会发生，任务停在 failed
    // 但保留 checkpoint。点“重试”后 Mock 要求必须拿到带分片的 checkpoint，否则失败。
    const fileName = `e2e-manual-retry-${Date.now()}.bin`
    const fileSize = 17 * MB
    const filePath = createFile(fileName, fileSize)

    const { app, window, userDataDir } = await launchApp()
    const accountId = await addMockAccount(window, `E2E-manual-${Date.now()}`)
    await selectMockBucket(window)

    await uploadAndWait(window, accountId, filePath, 'failed')

    await window.keyboard.press('Escape')
    await window.getByTestId(testId.openTransferCenter).click({ force: true })
    const task = window.getByTestId(testId.transferTask).filter({ hasText: fileName }).first()
    await expect(task.getByTestId(testId.retryTransfer)).toBeVisible({ timeout: 30_000 })

    await task.getByTestId(testId.retryTransfer).click()
    await expect(task.getByTestId(testId.taskStatus)).toHaveAttribute('data-status', 'success', {
      timeout: 60_000
    })

    const object = await window.evaluate(
      async ({ account, bucket, key }) => {
        const result = await window.api.listObjects(account, bucket)
        return result.objects.find((item) => item.key === key) ?? null
      },
      { account: accountId, bucket: MOCK_BUCKET, key: fileName }
    )
    expect(object?.size).toBe(fileSize)

    await closeApp(app, userDataDir)
    fs.rmSync(filePath, { force: true })
  })

  test('任务中心按状态筛选成功与失败任务', async () => {
    test.setTimeout(180_000)

    const successName = `e2e-filter-success-${Date.now()}.txt`
    const successPath = createFile(successName, 1024)
    // 不存在的本地文件会让任务失败，用于验证 failed 筛选。
    const missingName = `e2e-filter-missing-${Date.now()}.txt`
    const missingPath = path.join(os.tmpdir(), missingName)

    const { app, window, userDataDir } = await launchApp()
    const accountId = await addMockAccount(window, `E2E-filter-${Date.now()}`)
    await selectMockBucket(window)

    await uploadAndWait(window, accountId, successPath, 'success')
    await uploadAndWait(window, accountId, missingPath, 'failed')

    await window.keyboard.press('Escape')
    await window.getByTestId(testId.openTransferCenter).click({ force: true })
    await expect(window.getByTestId(testId.transferCenter)).toBeVisible()

    const successTask = window
      .getByTestId(testId.transferTask)
      .filter({ hasText: successName })
      .first()
    const failedTask = window
      .getByTestId(testId.transferTask)
      .filter({ hasText: missingName })
      .first()
    await expect(successTask).toBeVisible()
    await expect(failedTask).toBeVisible()

    await window.getByTestId(testId.transferStatusFilter).click()
    await window.getByTestId('transfer-status-filter-failed').click()
    await expect(failedTask).toBeVisible()
    await expect(successTask).not.toBeVisible()

    await window.getByTestId(testId.transferStatusFilter).click()
    await window.getByTestId('transfer-status-filter-success').click()
    await expect(successTask).toBeVisible()
    await expect(failedTask).not.toBeVisible()

    await closeApp(app, userDataDir)
    fs.rmSync(successPath, { force: true })
  })
})
