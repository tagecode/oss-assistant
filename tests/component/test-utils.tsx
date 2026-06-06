import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { I18nProvider } from '@/hooks/use-i18n'

const defaultSettings = {
  theme: 'system' as const,
  language: 'zh' as const,
  defaultDownloadPath: '/tmp/downloads',
  transferConcurrency: 3,
  logRetentionDays: 30,
  autoCheckUpdate: true
}

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false }
  }
})

testQueryClient.setQueryData(['settings'], defaultSettings)

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): ReturnType<typeof render> {
  testQueryClient.setQueryData(['settings'], defaultSettings)
  return render(
    <QueryClientProvider client={testQueryClient}>
      <I18nProvider>{ui}</I18nProvider>
    </QueryClientProvider>,
    options
  )
}
