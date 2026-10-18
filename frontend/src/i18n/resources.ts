import enCommon from './locales/en/common.json'
import enDev from './locales/en/dev.json'

/**
 * All user-facing strings live in locales/<lang>/<namespace>.json.
 * To add a language: create locales/<lang>/ with the same files and register
 * it here. Copy comes verbatim from the Figma frames.
 */
export const resources = {
  en: {
    common: enCommon,
    dev: enDev,
  },
} as const

export const defaultNS = 'common'
export const fallbackLanguage = 'en'
export const supportedLanguages = Object.keys(resources) as Array<keyof typeof resources>
