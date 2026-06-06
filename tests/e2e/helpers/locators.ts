import { expect, type Page } from '@playwright/test'

/** Language-agnostic selectors for E2E — use data-testid and stable form ids. */
export const testId = {
  emptyAccounts: 'empty-accounts',
  addAccount: 'add-account',
  accountForm: 'account-form-dialog',
  connectionTestSuccess: 'connection-test-success',
  testConnection: 'test-connection',
  saveAccount: 'save-account',
  openTransferCenter: 'open-transfer-center',
  transferCenter: 'transfer-center',
  transferTask: 'transfer-task',
  taskStatus: 'task-status',
  toolbarRefresh: 'toolbar-refresh',
  toolbarDelete: 'toolbar-delete',
  confirmDeleteObjects: 'confirm-delete-objects',
  settingsDialog: 'settings-dialog',
  helpDialog: 'help-dialog',
  headerSettings: 'header-settings',
  headerHelp: 'header-help',
  settingsLogRetention: 'settings-log-retention',
  settingsAutoUpdate: 'settings-auto-update',
  exportDiagnostics: 'export-diagnostics'
} as const

export async function openTransferCenter(window: Page): Promise<void> {
  await window.keyboard.press('Escape')
  await window.getByTestId(testId.openTransferCenter).click({ force: true })
  await expect(window.getByTestId(testId.transferCenter)).toBeVisible()
}

export async function waitForTransferSuccess(window: Page, objectKey: string): Promise<void> {
  await openTransferCenter(window)
  const task = window
    .getByTestId(testId.transferTask)
    .filter({ has: window.getByText(objectKey, { exact: false }) })
    .first()
  await expect(task).toBeVisible({ timeout: 120_000 })
  await expect(task.getByTestId(testId.taskStatus)).toHaveAttribute('data-status', 'success', {
    timeout: 120_000
  })
  await window.keyboard.press('Escape')
}
