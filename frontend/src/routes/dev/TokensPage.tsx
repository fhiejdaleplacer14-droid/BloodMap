import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GithubIcon } from '../../components/ui/GithubIcon'
import { icons, type IconName } from '../../components/ui/icons'
import { useTheme } from '../../app/theme/useTheme'
import type { ThemePreference } from '../../app/theme/theme'

/** Token paths as named in Figma (48:236), in the same order. */
const SEMANTIC_TOKENS = [
  'bg/canvas', 'bg/surface', 'bg/subtle', 'bg/inverse', 'bg/inverse-hover', 'bg/brand',
  'bg/brand-hover', 'bg/brand-pressed', 'bg/brand-soft', 'bg/overlay',
  'text/primary', 'text/secondary', 'text/tertiary', 'text/on-brand', 'text/on-inverse',
  'text/brand', 'text/link',
  'border/default', 'border/strong', 'border/brand', 'border/brand-soft', 'border/focus',
  'status/success/fg', 'status/success/bg', 'status/warning/fg', 'status/warning/bg',
  'status/critical/fg', 'status/critical/bg', 'status/info/fg', 'status/info/bg',
  'status/neutral/fg', 'status/neutral/bg',
  'map/land', 'map/water', 'map/park', 'map/road', 'map/road-major', 'map/boundary',
] as const

const TYPE_STYLES = [
  ['Display/56', 'type-display-56'],
  ['Display/48', 'type-display-48'],
  ['Heading/H1 · 32', 'type-h1'],
  ['Heading/H2 · 24', 'type-h2'],
  ['Heading/H3 · 20', 'type-h3'],
  ['Heading/H4 · 16', 'type-h4'],
  ['Body/L · 16', 'type-body-l'],
  ['Body/M · 14', 'type-body-m'],
  ['Body/M Strong · 14', 'type-body-m-strong'],
  ['Body/S · 13', 'type-body-s'],
  ['Label/M · 14', 'type-label-m'],
  ['Label/S · 12', 'type-label-s'],
  ['Overline · 11', 'type-overline'],
  ['Mono/M · 13', 'type-mono-m'],
  ['Mono/S · 12', 'type-mono-s'],
] as const

const SPACING = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16] as const
const RADII = ['xs', 'sm', 'md', 'lg', 'xl'] as const
const ELEVATIONS = ['raised', 'floating', 'overlay'] as const
const THEME_OPTIONS: ThemePreference[] = ['light', 'dark', 'system']

const cssVar = (path: string) => `var(--${path.replaceAll('/', '-')})`

function toHex(rgb: string): string {
  const parts = rgb.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? []
  return '#' + parts.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase()
}

function TokenRow({ token }: { token: string }) {
  const lightRef = useRef<HTMLSpanElement>(null)
  const darkRef = useRef<HTMLSpanElement>(null)
  const [values, setValues] = useState('')

  useLayoutEffect(() => {
    if (!lightRef.current || !darkRef.current) return
    const light = getComputedStyle(lightRef.current).backgroundColor
    const dark = getComputedStyle(darkRef.current).backgroundColor
    setValues(`${toHex(light)} · ${toHex(dark)}`)
  }, [])

  return (
    <li className="flex h-15 w-90 items-center gap-3 rounded-lg border border-default bg-surface px-3 py-2.5">
      <span data-theme="light" className="contents">
        <span ref={lightRef} className="size-9 shrink-0 rounded-sm border border-default" style={{ background: cssVar(token) }} />
      </span>
      <span data-theme="dark" className="contents">
        <span ref={darkRef} className="size-9 shrink-0 rounded-sm" style={{ background: cssVar(token) }} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="type-label-m text-primary">{token}</span>
        <span className="type-mono-s text-secondary">{values}</span>
      </span>
    </li>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="type-h2 text-primary">{title}</h2>
      {children}
    </section>
  )
}

export function TokensPage() {
  const { t } = useTranslation('dev')
  const { t: tc } = useTranslation()
  const { preference, setPreference } = useTheme()

  return (
    <main className="mx-auto flex max-w-[1600px] flex-col gap-10 p-16">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <p className="type-overline text-tertiary">02 — Design System</p>
          <h1 className="type-display-48 text-primary">{t('tokens.title')}</h1>
          <p className="type-body-l max-w-[1000px] text-secondary">{t('tokens.intro')}</p>
        </div>
        <fieldset className="flex items-center gap-4 rounded-md border border-default bg-surface px-4 py-2">
          <legend className="sr-only">{tc('theme.label')}</legend>
          {THEME_OPTIONS.map((option) => (
            <label key={option} className="type-label-m flex items-center gap-2 text-primary">
              <input
                type="radio"
                name="theme"
                value={option}
                checked={preference === option}
                onChange={() => setPreference(option)}
              />
              {tc(`theme.${option}`)}
            </label>
          ))}
        </fieldset>
      </header>

      <Section title={t('tokens.semantic')}>
        <ul className="flex flex-wrap gap-4">
          {SEMANTIC_TOKENS.map((token) => (
            <TokenRow key={token} token={token} />
          ))}
        </ul>
      </Section>

      <Section title={t('tokens.typography')}>
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-default bg-surface">
          {TYPE_STYLES.map(([name, utility]) => (
            <li key={utility} className="flex items-baseline gap-6 px-4 py-4">
              <span className="type-mono-s w-48 shrink-0 text-secondary">{name}</span>
              <span className={`${utility} text-primary`}>{t('tokens.sample')}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('tokens.spacing')}>
        <ul className="flex items-end gap-5">
          {SPACING.map((step) => (
            <li key={step} className="flex flex-col items-center gap-2">
              <span
                className="rounded-[2px] border border-brand bg-brand-soft"
                style={{ width: `var(--space-${step})`, height: `var(--space-${step})` }}
              />
              <span className="type-label-s text-primary">space/{step}</span>
              <span className="type-mono-s text-secondary">{step * 4}px</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('tokens.radius')}>
        <ul className="flex gap-6">
          {RADII.map((radius) => (
            <li key={radius} className="flex flex-col gap-2">
              <span
                className="h-20 w-30 border border-strong bg-canvas"
                style={{ borderRadius: `var(--radius-${radius})` }}
              />
              <span className="type-label-s text-primary">radius/{radius}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('tokens.elevation')}>
        <ul className="flex gap-8 rounded-lg bg-canvas p-8">
          {ELEVATIONS.map((level) => (
            <li
              key={level}
              className="type-label-m flex h-24 w-48 items-center justify-center rounded-lg bg-surface text-primary"
              style={{ boxShadow: `var(--shadow-${level})` }}
            >
              {level}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('tokens.icons')}>
        <ul className="flex flex-wrap gap-4 rounded-lg bg-canvas p-5 text-primary">
          {(Object.entries(icons) as Array<[IconName, (typeof icons)[IconName]]>).map(([name, Icon]) => (
            <li key={name} title={name}>
              <Icon size={24} aria-label={name} />
            </li>
          ))}
          <li title="github">
            <GithubIcon />
          </li>
        </ul>
      </Section>

      <Section title={t('tokens.focus')}>
        <button
          type="button"
          className="type-label-m w-fit rounded-md bg-inverse px-4 py-2.5 text-on-inverse"
        >
          {t('tokens.focusHint')}
        </button>
      </Section>
    </main>
  )
}
