import { createContext, useContext, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Language, LanguageSetting } from '../../../shared/types/storage'
import { resolveLocale, t, type MessageKey } from '@/lib/i18n'

interface I18nContextValue {
  locale: Language
  languageSetting: LanguageSetting
  setLanguage: (language: LanguageSetting) => void
  tr: (key: MessageKey, vars?: Record<string, string | number>) => string
  isLoading: boolean
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.api.getSettings()
  })

  const mutation = useMutation({
    mutationFn: (language: LanguageSetting) => window.api.updateSettings({ language }),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data)
    }
  })

  const languageSetting = settings?.language ?? 'system'
  const locale = useMemo(() => resolveLocale(languageSetting), [languageSetting])

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  useEffect(() => {
    if (languageSetting !== 'system') return
    const handler = (): void => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    }
    window.addEventListener('languagechange', handler)
    return () => window.removeEventListener('languagechange', handler)
  }, [languageSetting, queryClient])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      languageSetting,
      setLanguage: mutation.mutate,
      tr: (key, vars) => t(locale, key, vars),
      isLoading
    }),
    [locale, languageSetting, mutation.mutate, isLoading]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook paired with provider
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider')
  return context
}
