import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsDialog } from '@/components/settings/settings-dialog'
import { renderWithProviders } from '../test-utils'

const defaultSettings = {
  theme: 'system' as const,
  language: 'zh' as const,
  defaultDownloadPath: '/tmp/downloads',
  transferConcurrency: 3,
  logRetentionDays: 30,
  autoCheckUpdate: true
}

describe('SettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api.getSettings = vi.fn().mockResolvedValue(defaultSettings)
    window.api.updateSettings = vi.fn().mockImplementation(async (partial) => ({
      ...defaultSettings,
      ...partial
    }))
    window.api.getVersion = vi.fn().mockResolvedValue('1.0.0')
    window.api.getPlatform = vi.fn().mockResolvedValue('win32')
  })

  it('renders settings sections and version info', async () => {
    renderWithProviders(<SettingsDialog open onOpenChange={vi.fn()} />)

    expect(await screen.findByTestId('settings-dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument()
    expect(screen.getByText('外观')).toBeInTheDocument()
    expect(screen.getByText('语言')).toBeInTheDocument()
    expect(screen.getByText('传输')).toBeInTheDocument()
    expect(screen.getByText(/OSS 助手 v1\.0\.0/)).toBeInTheDocument()
  })

  it('updates log retention days', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsDialog open onOpenChange={vi.fn()} />)

    const input = await screen.findByTestId('settings-log-retention')
    await user.clear(input)
    await user.type(input, '7')

    await waitFor(() => {
      expect(window.api.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ logRetentionDays: 7 })
      )
    })
  })

  it('toggles auto check update', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SettingsDialog open onOpenChange={vi.fn()} />)

    const toggle = await screen.findByTestId('settings-auto-update')
    await user.click(toggle)

    await waitFor(() => {
      expect(window.api.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ autoCheckUpdate: false })
      )
    })
  })
})
