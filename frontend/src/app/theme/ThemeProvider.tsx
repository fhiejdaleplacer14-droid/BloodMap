import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext } from './ThemeContext'
import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  storePreference,
  subscribeToSystemTheme,
  type ThemePreference,
} from './theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [theme, setTheme] = useState(() => resolveTheme(preference))

  useEffect(() => {
    const sync = () => setTheme(resolveTheme(preference))
    sync()
    if (preference !== 'system') return
    return subscribeToSystemTheme(sync)
  }, [preference])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setPreference = useCallback((next: ThemePreference) => {
    storePreference(next)
    setPreferenceState(next)
  }, [])

  const value = useMemo(
    () => ({ preference, theme, setPreference }),
    [preference, theme, setPreference],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
