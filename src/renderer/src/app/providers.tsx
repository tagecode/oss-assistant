import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { I18nProvider } from '@/hooks/use-i18n'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1
    }
  }
})

export function Providers({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        {children}
        <Toaster richColors position="bottom-right" />
      </I18nProvider>
    </QueryClientProvider>
  )
}
