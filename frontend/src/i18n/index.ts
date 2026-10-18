import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources, defaultNS, supportedLanguages, fallbackLanguage } from './resources'

void i18n.use(initReactI18next).init({
  resources,
  lng: fallbackLanguage,
  fallbackLng: fallbackLanguage,
  supportedLngs: supportedLanguages,
  defaultNS,
  ns: Object.keys(resources[fallbackLanguage]),
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
})

// Keep <html lang> in sync for screen readers and hyphenation.
document.documentElement.lang = i18n.language
i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language
})

export default i18n
