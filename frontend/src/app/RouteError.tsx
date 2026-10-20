import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Logo } from '../components/domain/Logo'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'

/**
 * Last-resort screen when a page fails to render or a lazy chunk can't load
 * (decision #88). Plain language, a way back, nothing technical shown.
 */
export function RouteError() {
  const { t } = useTranslation('states')
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  if (import.meta.env.DEV) console.error(error)

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-14 items-center border-b border-default bg-surface px-4">
        <Link to="/" className="rounded-sm">
          <Logo />
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-center justify-center p-4">
        <EmptyState
          role="alert"
          tone={notFound ? 'neutral' : 'critical'}
          icon={notFound ? 'search' : 'alert-triangle'}
          title={notFound ? t('pageError.notFoundTitle') : t('pageError.title')}
          description={notFound ? t('pageError.notFoundBody') : t('pageError.body')}
          actions={
            <>
              {!notFound && (
                <Button variant="primary" icon="refresh" onClick={() => window.location.reload()}>
                  {t('pageError.reload')}
                </Button>
              )}
              <Button asChild variant="secondary">
                <Link to="/">{t('pageError.home')}</Link>
              </Button>
            </>
          }
        />
      </main>
    </div>
  )
}
