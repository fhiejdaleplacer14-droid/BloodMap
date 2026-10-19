import { Fragment, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BloodTypeTag } from '../../components/domain/BloodTypeTag'
import { StatusBadge } from '../../components/domain/StatusBadge'
import { UrgencyTag } from '../../components/domain/UrgencyTag'
import { RequestMap } from '../../components/map/RequestMap'
import { icons } from '../../components/ui/icons'
import type { ContactMethod, ContactVisibility } from '../../lib/api/myRequests'
import { cn } from '../../lib/cn'
import { formatShortDateTime } from '../../lib/datetime'
import type { BloodType, Province, PublicRequest, RequestStatus, Urgency } from '../../lib/request'
import type { Step } from './requestForm'

const MapPin = icons['map-pin']
const ShieldCheck = icons['shield-check']
const EyeOff = icons['eye-off']

/** Stepper (31:187): 28 px circles, ink for done/current, 48 px connectors. */
export function Stepper({ step }: { step: Step }) {
  const { t } = useTranslation('manage')
  const labels = [t('steps.info'), t('steps.coordination'), t('steps.review')]
  return (
    <ol aria-label={t('steps.label')} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {labels.map((label, index) => {
        const n = (index + 1) as Step
        const done = n < step
        const current = n === step
        return (
          <Fragment key={label}>
            {index > 0 && <li aria-hidden className={cn('h-0.5 w-12 max-sm:w-4', n <= step ? 'bg-inverse' : 'bg-line')} />}
            <li aria-current={current ? 'step' : undefined} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'type-label-s flex size-7 shrink-0 items-center justify-center rounded-full',
                  done || current ? 'bg-inverse text-on-inverse' : 'border border-strong bg-surface text-secondary',
                )}
              >
                {done ? <icons.check size={14} strokeWidth={3} /> : n}
              </span>
              <span className={cn('type-label-m', current || done ? 'text-primary' : 'text-secondary', !current && 'max-sm:sr-only')}>
                {done ? <span className="sr-only">{t('steps.done', { label })}</span> : null}
                <span aria-hidden={done || undefined}>{label}</span>
              </span>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}

/** White panel with header, body and a footer action bar (31:188). */
export function WizardPanel({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl border border-default bg-surface">
      <h2 className="type-h4 px-5 pt-5 text-primary">{title}</h2>
      <div className="flex flex-col gap-5 p-5">{children}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-default px-5 py-4">{footer}</div>
    </section>
  )
}

export type PreviewData = {
  blood_type: BloodType | ''
  municipality: string | null
  province: string | null
  point: [number, number] | null
  summary: string
  urgency: Urgency
  expiresAt: string | null
  status: RequestStatus
  contactMethod: ContactMethod
  contactVisibleTo: ContactVisibility
}

/** "What the public will see" (31:380): preview card, visibility list, and on review the approximate area. */
export function PublicPreview({ data, withMap }: { data: PreviewData; withMap?: boolean }) {
  const { t, i18n } = useTranslation(['manage', 'request'])
  const [now] = useState(() => new Date())
  const year = now.getFullYear()
  const contactKey = data.contactMethod === 'none' ? 'none' : data.contactVisibleTo

  const mapRequest: PublicRequest | null =
    withMap && data.point && data.municipality && data.blood_type
      ? {
          id: 'preview',
          blood_type: data.blood_type,
          units_requested: null,
          needed_by: null,
          desk_window: null,
          urgency: data.urgency,
          category: null,
          status: 'active',
          location: { municipality: data.municipality, province: (data.province ?? '') as Province, point: data.point, precision: 'municipality' },
          coordination_point: { id: 0, name: '', hours: null },
          contact: null,
          public_summary: '',
          response_instructions: null,
          published_at: null,
          updated_at: now.toISOString(),
          expires_at: null,
          is_demo: false,
          is_saved: false,
          can: { save: false, report: false },
        }
      : null

  return (
    <aside aria-labelledby="public-preview" className="flex flex-col gap-3">
      <h2 id="public-preview" className="type-overline text-tertiary">
        {t('preview.heading')}
      </h2>

      <div className="flex flex-col gap-3 rounded-lg border border-default bg-surface p-4">
        <div className="flex items-start gap-3">
          {data.blood_type ? (
            <BloodTypeTag type={data.blood_type} />
          ) : (
            <span aria-hidden className="size-13 shrink-0 rounded-md border border-dashed border-strong" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="type-mono-m text-secondary">{t('preview.pendingId', { year })}</span>
              <StatusBadge status={data.status} />
            </div>
            <div className="flex min-w-0 items-center gap-1">
              <MapPin aria-hidden size={14} className="shrink-0 text-secondary" />
              <span className={cn('type-label-m truncate', data.municipality ? 'text-primary' : 'text-tertiary')}>
                {data.municipality ?? t('preview.chooseLocation')}
              </span>
              {data.province && <span className="type-body-s shrink-0 text-tertiary">· {data.province}</span>}
            </div>
          </div>
        </div>
        <p className={cn('type-body-s break-words', data.summary ? 'text-secondary' : 'text-tertiary')}>
          {data.summary || t('preview.noSummary')}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <UrgencyTag urgency={data.urgency} />
          {data.expiresAt && (
            <span className="type-mono-s inline-flex items-center gap-1 text-secondary">
              <icons.hourglass aria-hidden size={14} className="shrink-0" />
              {t('request:card.expires', { when: formatShortDateTime(data.expiresAt, i18n.language) })}
            </span>
          )}
        </div>
        <span aria-hidden className="h-px w-full bg-line" />
        <span className="type-body-s inline-flex items-center gap-1 text-tertiary">
          <ShieldCheck aria-hidden size={14} className="shrink-0" />
          {t('preview.footer')}
        </span>
      </div>

      <ul className="flex flex-col gap-2 rounded-lg border border-default bg-surface p-4">
        {(['basics', 'city', 'point'] as const).map((key) => (
          <li key={key} className="type-body-s flex items-center gap-2 text-primary">
            <icons.eye aria-label={t('preview.visibleLabel')} size={16} className="shrink-0 text-status-success" />
            {t(`preview.visible.${key}`)}
          </li>
        ))}
        {[t(`preview.contact.${contactKey}`), t('preview.account')].map((text) => (
          <li key={text} className="type-body-s flex items-center gap-2 text-secondary">
            <EyeOff aria-label={t('preview.hiddenLabel')} size={16} className="shrink-0 text-tertiary" />
            {text}
          </li>
        ))}
      </ul>

      {mapRequest && (
        <div className="relative h-44 overflow-hidden rounded-lg border border-default">
          <RequestMap
            className="size-full"
            label={t('preview.mapLabel', { city: mapRequest.location.municipality })}
            requests={[mapRequest]}
            selectedId={mapRequest.id}
            areaFor={mapRequest}
            initialView={{ center: [mapRequest.location.point[1], mapRequest.location.point[0]], zoom: 12 }}
            interactive={false}
          />
        </div>
      )}
    </aside>
  )
}
