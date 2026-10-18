import { createContext } from 'react'
import type { ResolvedTheme, ThemePreference } from './theme'

export type ThemeContextValue = {
  /** What the user chose ('system' follows the OS setting). */
  preference: ThemePreference
  /** What is actually applied to <html data-theme>. */
  theme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
