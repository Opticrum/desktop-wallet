import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { en } from './en'
import { zh } from './zh'
import type { Locale, Messages } from './types'

export type { Locale }

type LocaleCtx = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: Messages
}

const LocaleContext = createContext<LocaleCtx | null>(null)
const KEY = 'opticrum-locale'
const dict: Record<Locale, Messages> = { zh, en }

function readLocale(): Locale {
  const saved = localStorage.getItem(KEY)
  return saved === 'en' ? 'en' : 'zh'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale)

  const setLocale = (l: Locale) => {
    localStorage.setItem(KEY, l)
    setLocaleState(l)
  }

  const value = useMemo(
    () => ({ locale, setLocale, t: dict[locale] }),
    [locale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale outside LocaleProvider')
  return ctx
}