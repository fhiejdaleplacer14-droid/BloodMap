import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Freshness } from '../../components/domain/Freshness'
import { StatusBadge } from '../../components/domain/StatusBadge'
import { SiteHeader, SkipLink } from '../../components/layout/SiteHeader'
import { Button } from '../../components/ui/Button'
import { icons, type IconName } from '../../components/ui/icons'
import { useRequestSearch } from '../../lib/api/requests'
import { cn } from '../../lib/cn'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { Footer } from './Footer'
import { Hero } from './Hero'
import { RegionalFocus } from './RegionalFocus'

const ArrowRight = icons['arrow-right']

const SECTION = 'px-[clamp(16px,8vw,120px)] py-[clamp(56px,7vw,96px)]'

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex max-w-[720px] flex-col gap-3">
      <p className="type-overline text-tertiary">{eyebrow}</p>
      <h2 className="type-h1 text-primary">{title}</h2>
    </div>
  )
}

/** Illustrative timestamps for the indicator examples (not request data). */
const HOURS_AGO = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

function Principle({ icon, title, body, proof }: { icon: IconName; title: string; body: string; proof: ReactNode }) {
  const Icon = icons[icon]
  return (
    <div className="flex flex-1 flex-col gap-4 rounded-xl border border-default bg-canvas p-6">
      <span className="flex size-11 items-center justify-center rounded-[10px] border border-default bg-subtle text-primary">
        <Icon aria-hidden size={20} />
      </span>
      <h3 className="type-h3 text-primary">{title}</h3>
      <p className="type-body-m flex-1 text-secondary">{body}</p>
      <div className="flex flex-wrap items-center gap-2 border-t border-default pt-4">{proof}</div>
    </div>
  )
}

function Trust() {
  const { t } = useTranslation('landing')
  return (
    <section className={cn(SECTION, 'bg-surface')}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
        <div className="flex max-w-[720px] flex-col gap-3">
          <p className="type-overline text-tertiary">{t('trust.eyebrow')}</p>
          <h2 className="type-h1 text-primary">{t('trust.title')}</h2>
          <p className="type-body-l text-secondary">{t('trust.body')}</p>
        </div>
        <div className="flex items-start gap-6 max-lg:flex-col max-lg:items-stretch">
          <Principle
            icon="clock"
            title={t('trust.current.title')}
            body={t('trust.current.body')}
            proof={
              <>
                <Freshness updatedAt={HOURS_AGO(2)} label={t('trust.current.freshness')} level="fresh" tooltip={false} />
                <span className="type-mono-s inline-flex items-center gap-1 text-secondary">
                  <icons.hourglass aria-hidden size={14} />
                  {t('trust.current.expires')}
                </span>
              </>
            }
          />
          <Principle
            icon="shield-check"
            title={t('trust.authorized.title')}
            body={t('trust.authorized.body')}
            proof={
              <>
                <StatusBadge status="active" />
                <span className="type-body-s text-secondary">{t('trust.authorized.proof')}</span>
              </>
            }
          />
          <Principle
            icon="map-pin"
            title={t('trust.privacy.title')}
            body={t('trust.privacy.body')}
            proof={
              <span className="type-body-s inline-flex items-center gap-2 text-secondary">
                <span aria-hidden className="size-[18px] rounded-full border-[1.5px] border-dashed border-brand bg-brand-soft" />
                {t('trust.privacy.proof')}
              </span>
            }
          />
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const { t } = useTranslation('landing')
  const steps: Array<{ key: 'discover' | 'review' | 'follow'; icon: IconName }> = [
    { key: 'discover', icon: 'search' },
    { key: 'review', icon: 'file-text' },
    { key: 'follow', icon: 'building' },
  ]
  return (
    <section id="how-it-works" className={cn(SECTION, 'scroll-mt-16 border-y border-default bg-canvas')}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8">
        <SectionHead eyebrow={t('how.eyebrow')} title={t('how.title')} />
        <ol className="flex gap-6 max-lg:flex-col">
          {steps.map(({ key, icon }, index) => {
            const Icon = icons[icon]
            return (
              <li key={key} className="flex flex-1 flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="type-mono-m text-brand">{String(index + 1).padStart(2, '0')}</span>
                  <span aria-hidden className="h-px flex-1 bg-[var(--border-strong)]" />
                </div>
                <span className="flex size-11 items-center justify-center rounded-[10px] border border-brand-soft bg-brand-soft text-brand">
                  <Icon aria-hidden size={20} />
                </span>
                <h3 className="type-h3 text-primary">{t(`how.steps.${key}.title`)}</h3>
                <p className="type-body-m text-secondary">{t(`how.steps.${key}.body`)}</p>
              </li>
            )
          })}
        </ol>
        <div>
          <Button asChild variant="primary">
            <Link to="/#safety">
              <ArrowRight aria-hidden size={16} />
              {t('how.guide')}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function SafetyCard({ icon, title, body, children }: { icon: IconName; title: string; body: string; children: ReactNode }) {
  const Icon = icons[icon]
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[color-mix(in_srgb,var(--text-on-inverse)_12%,transparent)] bg-[color-mix(in_srgb,var(--text-on-inverse)_4%,transparent)] p-6">
      <h3 className="type-h4 flex items-center gap-3 text-on-inverse">
        <Icon aria-hidden size={20} />
        {title}
      </h3>
      <p className="type-body-m text-on-inverse-muted">{body}</p>
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-surface p-3">{children}</div>
    </div>
  )
}

function Safety() {
  const { t } = useTranslation('landing')
  return (
    <section id="safety" className={cn(SECTION, 'scroll-mt-16 bg-inverse')}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8">
        <div className="flex max-w-[760px] flex-col gap-3">
          <p className="type-overline text-on-inverse-muted">{t('safety.eyebrow')}</p>
          <h2 className="type-h1 text-on-inverse">{t('safety.title')}</h2>
          <p className="type-body-l text-on-inverse-muted">{t('safety.body')}</p>
        </div>
        <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
          <SafetyCard icon="shield-check" title={t('safety.status.title')} body={t('safety.status.body')}>
            <StatusBadge status="pending_review" />
            <StatusBadge status="active" />
            <StatusBadge status="fulfilled" />
            <StatusBadge status="expired" />
          </SafetyCard>
          <SafetyCard icon="clock" title={t('safety.freshness.title')} body={t('safety.freshness.body')}>
            <Freshness updatedAt={HOURS_AGO(2)} label={t('safety.freshness.fresh')} level="fresh" tooltip={false} />
            <Freshness updatedAt={HOURS_AGO(48)} label={t('safety.freshness.aging')} level="aging" tooltip={false} />
            <Freshness updatedAt={HOURS_AGO(120)} label={t('safety.freshness.stale')} level="stale" tooltip={false} />
          </SafetyCard>
          <SafetyCard icon="lock" title={t('safety.contact.title')} body={t('safety.contact.body')}>
            <span className="type-body-s inline-flex items-center gap-1.5 text-secondary">
              <icons.lock aria-hidden size={14} />
              {t('safety.contact.proof')}
            </span>
          </SafetyCard>
          <SafetyCard icon="alert-circle" title={t('safety.medical.title')} body={t('safety.medical.body')}>
            <span className="type-body-s inline-flex items-center gap-1.5 text-status-info">
              <icons.info aria-hidden size={14} />
              {t('safety.medical.proof')}
            </span>
          </SafetyCard>
        </div>
      </div>
    </section>
  )
}

function ClosingCta() {
  const { t } = useTranslation('landing')
  return (
    <section className="bg-canvas px-[clamp(16px,8vw,120px)] py-16">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 rounded-xl border border-default bg-surface px-10 py-8 max-lg:flex-col max-lg:items-start max-sm:px-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="type-h2 text-primary">{t('cta.title')}</h2>
          <p className="type-body-l text-secondary">{t('cta.body')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link to="/#safety">{t('cta.safety')}</Link>
          </Button>
          <Button asChild variant="brand">
            <Link to="/requests">
              <icons.search aria-hidden size={16} />
              {t('cta.explore')}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

/** Public / Landing / Desktop (20:3397). */
export function LandingPage() {
  useDocumentTitle()
  const { hash } = useLocation()
  // The same query feeds the hero preview and the regional map.
  const latest = useRequestSearch({})
  const requests = latest.data?.data ?? []

  // Section links (/#how-it-works, /#safety, /#about) scroll into view.
  useEffect(() => {
    if (!hash) return
    const target = document.getElementById(hash.slice(1))
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [hash])

  return (
    <div className="min-h-dvh bg-canvas">
      <SkipLink />
      <div className="sticky top-0 z-30">
        <SiteHeader cta="find" />
      </div>
      <main id="main">
        <Hero requests={requests} loading={latest.isPending} />
        <Trust />
        <HowItWorks />
        <RegionalFocus requests={requests} />
        <Safety />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  )
}
