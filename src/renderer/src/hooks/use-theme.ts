import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ThemeMode } from '../../../shared/types/storage'

function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  }
}

export function useTheme(): {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  isLoading: boolean
} {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.api.getSettings()
  })

  const mutation = useMutation({
    mutationFn: (theme: ThemeMode) => window.api.updateSettings({ theme }),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data)
      applyTheme(data.theme)
    }
  })

  useEffect(() => {
    if (settings?.theme) applyTheme(settings.theme)
  }, [settings?.theme])

  useEffect(() => {
    if (settings?.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [settings?.theme])

  return {
    theme: settings?.theme ?? 'system',
    setTheme: mutation.mutate,
    isLoading
  }
}
