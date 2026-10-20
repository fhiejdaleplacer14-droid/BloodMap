import enAdmin from './locales/en/admin.json'
import enAssistant from './locales/en/assistant.json'
import enAuth from './locales/en/auth.json'
import enCommon from './locales/en/common.json'
import enCoord from './locales/en/coord.json'
import enDev from './locales/en/dev.json'
import enExplorer from './locales/en/explorer.json'
import enLanding from './locales/en/landing.json'
import enManage from './locales/en/manage.json'
import enNav from './locales/en/nav.json'
import enRequest from './locales/en/request.json'
import enStates from './locales/en/states.json'
import enWorkspace from './locales/en/workspace.json'

/**
 * All user-facing strings live in locales/<lang>/<namespace>.json.
 * To add a language: create locales/<lang>/ with the same files and register
 * it here. Copy comes verbatim from the Figma frames.
 */
export const resources = {
  en: {
    common: enCommon,
    nav: enNav,
    request: enRequest,
    states: enStates,
    landing: enLanding,
    explorer: enExplorer,
    auth: enAuth,
    workspace: enWorkspace,
    manage: enManage,
    coord: enCoord,
    admin: enAdmin,
    assistant: enAssistant,
    dev: enDev,
  },
} as const

export const defaultNS = 'common'
export const fallbackLanguage = 'en'
export const supportedLanguages = Object.keys(resources) as Array<keyof typeof resources>
