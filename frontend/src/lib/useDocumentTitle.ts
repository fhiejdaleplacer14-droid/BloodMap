import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** "<page> · BloodMap NIR" — or just the app name for Home. */
export function useDocumentTitle(page?: string) {
  const { t } = useTranslation()
  const appName = t('appName')
  useEffect(() => {
    document.title = page ? `${page} · ${appName}` : appName
  }, [page, appName])
}
