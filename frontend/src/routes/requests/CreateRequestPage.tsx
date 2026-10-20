import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MobilePageHeader } from '../../components/layout/MobilePageHeader'
import { PageHeader } from '../../components/layout/WorkspaceLayout'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { DateField, TimeField } from '../../components/ui/DateTimeField'
import { EmptyState } from '../../components/ui/EmptyState'
import { icons } from '../../components/ui/icons'
import { RadioGroup } from '../../components/ui/RadioGroup'
import { SelectField } from '../../components/ui/SelectField'
import { Skeleton } from '../../components/ui/Skeleton'
import { TextAreaField } from '../../components/ui/TextAreaField'
import { TextField } from '../../components/ui/TextField'
import { toast } from '../../components/ui/toast'
import { errorBody, errorStatus } from '../../lib/api/client'
import {
  CATEGORIES,
  CONTACT_METHODS,
  CONTACT_VISIBILITIES,
  useManagedRequest,
  useOwnCoordinationPoints,
  useSaveDraft,
  useSubmitRequest,
  type ManagedRequest,
  type OwnCoordinationPoint,
} from '../../lib/api/myRequests'
import { useMunicipalities, type Municipality } from '../../lib/api/requests'
import { manilaToday } from '../../lib/dates'
import { formatCalendarDate, formatDate, formatTime } from '../../lib/datetime'
import { BLOOD_TYPES, displayBloodType, PROVINCES } from '../../lib/request'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import {
  deriveUrgency,
  emptyValues,
  fromRequest,
  INSTRUCTIONS_MAX,
  requestSchema,
  STEP_FIELDS,
  stepOf,
  SUMMARY_MAX,
  toDraft,
  windowClosesAt,
  type RequestFormValues,
  type Step,
} from './requestForm'
import { PublicPreview, Stepper, WizardPanel } from './WizardParts'

const AlertTriangle = icons['alert-triangle']
const ArrowLeft = icons['arrow-left']
const ShieldCheck = icons['shield-check']
const CheckCircle = icons['check-circle']

function parseStep(value: string | null): Step {
  return value === '2' ? 2 : value === '3' ? 3 : 1
}

/**
 * Requests / Create (31:2 → 31:726). Three steps in the URL
 * (/requests/new?step=1..3&id=…). Each "Continue" saves the draft — POST the
 * first time, PATCH after (decision #7) — so nothing is lost between steps.
 */
export function CreateRequestPage() {
  const { t } = useTranslation(['manage', 'states'])
  const [params, setParams] = useSearchParams()
  const paramId = params.get('id')
  const step: Step = paramId ? parseStep(params.get('step')) : 1
  const points = useOwnCoordinationPoints()
  const municipalities = useMunicipalities()
  const existing = useManagedRequest(paramId)

  // A new session (fresh form) whenever the URL points at a different
  // request — but not when this form just created the draft itself.
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [session, setSession] = useState({ key: 0, id: paramId })
  if (session.id !== paramId) {
    setSession({ key: paramId !== null && paramId === createdId ? session.key : session.key + 1, id: paramId })
  }

  const goTo = (next: Step, id: string | null = paramId) => {
    setParams(id ? { step: String(next), id } : {}, { replace: next === step })
    document.getElementById('main')?.scrollTo({ top: 0 })
  }

  const heading =
    step === 3
      ? { title: t('create.reviewTitle'), subtitle: t('create.reviewSubtitle') }
      : existing.data && existing.data.status !== 'draft'
        ? { title: t('create.editTitle', { id: existing.data.id }), subtitle: step === 2 ? t('create.coordinationSubtitle') : t('create.subtitle') }
        : { title: t('create.title'), subtitle: step === 2 ? t('create.coordinationSubtitle') : t('create.subtitle') }
  useDocumentTitle(heading.title)

  let body: React.ReactNode
  if (points.isPending || municipalities.isPending || (paramId && existing.isPending)) {
    body = (
      <div aria-busy="true" aria-label={t('create.loading')} className="flex flex-col gap-4">
        <Skeleton className="h-8 w-96 max-w-full" />
        <Skeleton className="h-120 w-full rounded-xl" />
      </div>
    )
  } else if (existing.isError && errorStatus(existing.error) === 404) {
    body = (
      <EmptyState
        icon="search"
        title={t('detail.notFound')}
        description={t('detail.notFoundBody')}
        actions={
          <Button asChild variant="secondary">
            <Link to="/requests/mine">{t('detail.back')}</Link>
          </Button>
        }
      />
    )
  } else if (points.isError || municipalities.isError || existing.isError) {
    body = (
      <EmptyState
        role="alert"
        tone="critical"
        icon="wifi-off"
        title={t('states:networkError.title')}
        description={t('states:networkError.body')}
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => {
              void points.refetch()
              void municipalities.refetch()
              if (paramId) void existing.refetch()
            }}
          >
            {t('states:networkError.action')}
          </Button>
        }
      />
    )
  } else if (existing.data && !existing.data.can.update) {
    body = (
      <EmptyState
        icon="lock"
        title={t('create.notEditable')}
        description={t('create.notEditableBody')}
        actions={
          <Button asChild variant="secondary">
            <Link to={`/requests/mine/${encodeURIComponent(existing.data.id)}`}>{t('actions.view')}</Link>
          </Button>
        }
      />
    )
  } else {
    body = (
      <RequestWizard
        key={session.key}
        initial={existing.data}
        point={points.data?.[0]}
        municipalities={municipalities.data ?? []}
        step={step}
        requestId={paramId}
        goTo={goTo}
        onCreated={setCreatedId}
      />
    )
  }

  return (
    <>
      <MobilePageHeader
        title={existing.data && existing.data.status !== 'draft' ? heading.title : t('create.mobileTitle')}
        backTo="/requests/mine"
        backLabel={t('detail.back')}
      />
      <div className="mx-auto flex w-full max-w-[calc(1112px+4rem)] flex-col gap-6 p-8 max-lg:pb-28 max-sm:p-4 max-sm:pb-28">
        <div className="flex flex-col gap-6 max-lg:hidden">
          <PageHeader title={heading.title} subtitle={heading.subtitle} />
          <Stepper step={step} />
        </div>
        {body}
      </div>
    </>
  )
}

type WizardProps = {
  initial: ManagedRequest | undefined
  municipalities: Municipality[]
  point: OwnCoordinationPoint | undefined
  step: Step
  requestId: string | null
  goTo: (step: Step, id?: string | null) => void
  onCreated: (id: string) => void
}

function RequestWizard({ initial, municipalities, point, step, requestId, goTo, onCreated }: WizardProps) {
  const { t } = useTranslation(['manage', 'request', 'common'])
  const navigate = useNavigate()
  const latest = useManagedRequest(requestId).data ?? initial
  const save = useSaveDraft()
  const submit = useSubmitRequest()
  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema(t)),
    defaultValues: initial ? fromRequest(initial) : emptyValues(point),
    mode: 'all',
  })
  const values = useWatch({ control: form.control }) as RequestFormValues
  const municipality = municipalities.find((m) => String(m.id) === values.municipality_id)
  const closesAt = windowClosesAt(values.needed_by, values.desk_window_end)
  const busy = save.isPending || submit.isPending

  const applyServerErrors = (error: unknown) => {
    const errors = errorStatus(error) === 422 ? errorBody(error)?.errors : undefined
    const fields = Object.keys(errors ?? {}).filter((field) => field in values) as (keyof RequestFormValues)[]
    if (errors && fields.length > 0) {
      fields.forEach((field) => form.setError(field, { message: errors[field]?.[0] }))
      goTo(stepOf(fields[0]), requestId)
      toast({ tone: 'error', title: t('create.fixErrors') })
      return
    }
    toast({ tone: 'error', title: t('create.saveFailed'), message: t('create.saveFailedBody') })
  }

  const persist = async (): Promise<ManagedRequest | null> => {
    try {
      const saved = await save.mutateAsync({ id: requestId, values: toDraft(form.getValues()) })
      if (!requestId) onCreated(saved.id)
      return saved
    } catch (error) {
      applyServerErrors(error)
      return null
    }
  }

  const saveDraft = async () => {
    // The server needs a blood type and a place to create the draft.
    if (!(await form.trigger(['blood_type', 'municipality_id'], { shouldFocus: true }))) return goTo(1, requestId)
    const saved = await persist()
    if (!saved) return
    toast({ tone: 'success', title: t('create.draftSaved'), message: t('create.draftSavedBody', { id: saved.id }) })
    if (!requestId) goTo(step, saved.id)
  }

  const next = async () => {
    if (!(await form.trigger(STEP_FIELDS[step], { shouldFocus: true }))) return
    const saved = await persist()
    if (saved) goTo((step + 1) as Step, saved.id)
  }

  const submitForReview = async () => {
    if (!(await form.trigger())) {
      const first = Object.keys(form.formState.errors)[0]
      if (first) goTo(stepOf(first), requestId)
      return
    }
    if (!form.getValues('confirmed')) {
      form.setError('confirmed', { message: t('errors.confirm') }, { shouldFocus: true })
      return
    }
    const saved = await persist()
    if (!saved) return
    submit.mutate(saved.id, {
      onSuccess: (request) => navigate(`/requests/mine/${encodeURIComponent(request.id)}/submitted`),
      onError: applyServerErrors,
    })
  }

  const draftButton = (
    <Button variant="secondary" onClick={() => void saveDraft()} disabled={busy} loading={save.isPending && !submit.isPending}>
      {t('create.saveDraft')}
    </Button>
  )
  const backButton =
    step === 1 ? (
      <Button asChild variant="tertiary">
        <Link to="/requests/mine">{t('create.cancel')}</Link>
      </Button>
    ) : (
      <Button variant="tertiary" onClick={() => goTo((step - 1) as Step)}>
        <ArrowLeft aria-hidden size={16} />
        {t('create.back')}
      </Button>
    )

  const stepLabel = [t('steps.info'), t('steps.coordination'), t('steps.review')][step - 1]

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_392px]">
      {/* Phone progress (44:977): step, Save draft, three segments. */}
      <div className="-mt-1 flex flex-col gap-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="type-label-m text-primary">{t('steps.progress', { n: step, label: stepLabel })}</p>
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={busy}
            className="type-label-m shrink-0 rounded-sm text-link hover:underline disabled:text-tertiary"
          >
            {t('create.saveDraft')}
          </button>
        </div>
        <div aria-hidden className="grid grid-cols-3 gap-1">
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= step ? 'h-1 rounded-full bg-inverse' : 'h-1 rounded-full bg-subtle'} />
          ))}
        </div>
      </div>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void (step === 3 ? submitForReview() : next())
        }}
        className="flex flex-col gap-4"
      >
        {latest?.status === 'needs_correction' && latest.correction_note && (
          <div role="note" className="flex gap-2 rounded-lg bg-status-warning px-4 py-3 text-status-warning">
            <icons.message aria-hidden size={18} className="mt-0.5 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <p className="type-label-m">{t('create.correctionTitle')}</p>
              <p className="type-body-m">{latest.correction_note}</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <WizardPanel
            title={t('steps.info')}
            footer={
              <>
                {backButton}
                <div className="flex flex-wrap gap-2">
                  {draftButton}
                  <Button type="submit" variant="primary" loading={save.isPending} disabled={busy}>
                    {t('create.toCoordination')}
                  </Button>
                </div>
              </>
            }
          >
            <StepInfo form={form} municipalities={municipalities} />
          </WizardPanel>
        )}

        {step === 2 && (
          <WizardPanel
            title={t('pointPanel.title')}
            footer={
              <>
                {backButton}
                <div className="flex flex-wrap gap-2">
                  {draftButton}
                  <Button type="submit" variant="primary" loading={save.isPending} disabled={busy}>
                    {t('create.toReview')}
                  </Button>
                </div>
              </>
            }
          >
            <StepCoordination form={form} point={point} />
          </WizardPanel>
        )}

        {step === 3 && (
          <WizardPanel
            title={t('review.summary')}
            footer={
              <>
                {backButton}
                <div className="flex flex-wrap gap-2">
                  {draftButton}
                  <Button type="submit" variant="primary" icon="send" loading={submit.isPending} disabled={busy}>
                    {latest?.status === 'needs_correction' ? t('create.resubmit') : t('create.submit')}
                  </Button>
                </div>
              </>
            }
          >
            <StepReview
              form={form}
              values={values}
              municipality={municipality}
              point={point}
              closesAt={closesAt}
              flags={latest?.privacy_review?.flags ?? []}
              goTo={(n) => goTo(n)}
            />
          </WizardPanel>
        )}

        <div className="fixed inset-x-0 bottom-0 z-20 flex gap-3 border-t border-default bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          {step > 1 && (
            <Button variant="secondary" onClick={() => goTo((step - 1) as Step)} disabled={busy}>
              <ArrowLeft aria-hidden size={16} />
              {t('create.back')}
            </Button>
          )}
          <div className="flex-1">
            <Button type="submit" variant="primary" icon={step === 3 ? 'send' : undefined} className="w-full" loading={step === 3 ? submit.isPending : save.isPending} disabled={busy}>
              {step === 1
                ? t('create.toCoordination')
                : step === 2
                  ? t('create.toReview')
                  : latest?.status === 'needs_correction'
                    ? t('create.resubmit')
                    : t('create.submit')}
            </Button>
          </div>
        </div>
      </form>

      <div className="max-lg:hidden">
      <PublicPreview
        withMap={step === 3}
        data={{
          blood_type: values.blood_type,
          municipality: municipality?.name ?? null,
          province: municipality?.province ?? null,
          point: municipality?.point ?? null,
          summary: values.public_summary.trim(),
          urgency: deriveUrgency(closesAt),
          expiresAt: closesAt,
          status: step === 3 ? 'pending_review' : 'draft',
          contactMethod: values.contact_method,
          contactVisibleTo: values.contact_visible_to,
        }}
      />
      </div>
    </div>
  )
}

type FormProp = { form: UseFormReturn<RequestFormValues> }

function StepInfo({ form, municipalities }: FormProp & { municipalities: Municipality[] }) {
  const { t } = useTranslation(['manage', 'request'])
  const { register, formState, setValue, control } = form
  const errors = formState.errors
  const province = useWatch({ control, name: 'province' })
  const summary = useWatch({ control, name: 'public_summary' })
  const inProvince = municipalities.filter((m) => !province || m.province === province)

  return (
    <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
      <SelectField label={t('fields.bloodType')} placeholder={t('fields.chooseBloodType')} error={errors.blood_type?.message} {...register('blood_type')}>
        {BLOOD_TYPES.map((type) => (
          <option key={type} value={type} aria-label={t(`request:bloodType.spoken.${type}`)}>
            {displayBloodType(type)}
          </option>
        ))}
      </SelectField>
      <TextField
        label={t('fields.units')}
        inputMode="numeric"
        helperText={t('fields.unitsHelp')}
        error={errors.units_requested?.message}
        {...register('units_requested')}
      />
      <DateField
        label={t('fields.neededBy')}
        min={manilaToday()}
        helperText={t('fields.neededByHelp')}
        error={errors.needed_by?.message}
        {...register('needed_by')}
      />
      <fieldset className="flex min-w-0 flex-col">
        <legend className="type-label-m text-primary">{t('fields.deskWindow')}</legend>
        <div className="grid grid-cols-2 gap-2">
          <TimeField
            label={<span className="sr-only">{t('fields.deskFrom')}</span>}
            error={errors.desk_window_start?.message}
            {...register('desk_window_start', { deps: ['desk_window_end'] })}
          />
          <TimeField
            label={<span className="sr-only">{t('fields.deskTo')}</span>}
            error={errors.desk_window_end?.message}
            {...register('desk_window_end', { deps: ['desk_window_start'] })}
          />
        </div>
      </fieldset>
      <SelectField
        label={t('fields.province')}
        {...register('province', {
          onChange: () => setValue('municipality_id', '', { shouldValidate: formState.isSubmitted }),
        })}
      >
        {PROVINCES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={t('fields.municipality')}
        placeholder={t('fields.chooseMunicipality')}
        helperText={t('fields.municipalityHelp')}
        error={errors.municipality_id?.message}
        {...register('municipality_id')}
      >
        {inProvince.map((m) => (
          <option key={m.id} value={String(m.id)}>
            {m.name}
          </option>
        ))}
      </SelectField>
      <SelectField label={t('fields.category')} placeholder={t('fields.chooseCategory')} className="sm:col-span-2" {...register('category')}>
        {CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {t(`options.category.${category}`)}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        label={t('fields.summary')}
        rows={3}
        maxChars={SUMMARY_MAX}
        charCount={summary.length}
        helperText={t('fields.summaryHelp')}
        error={errors.public_summary?.message}
        className="sm:col-span-2"
        {...register('public_summary')}
      />
      <p role="note" className="type-body-s flex gap-2 rounded-md bg-status-warning px-3 py-2.5 text-status-warning sm:col-span-2">
        <AlertTriangle aria-hidden size={16} className="mt-px shrink-0" />
        {t('warning')}
      </p>
    </div>
  )
}

function StepCoordination({ form, point }: FormProp & { point: OwnCoordinationPoint | undefined }) {
  const { t } = useTranslation('manage')
  const { register, control, formState } = form
  const method = useWatch({ control, name: 'contact_method' })
  const instructions = useWatch({ control, name: 'response_instructions' })

  return (
    <>
      <p className="type-body-s -mt-4 text-secondary">{t('pointPanel.body')}</p>
      {point ? (
        <SelectField label={t('fields.point')} helperText={t('fields.pointHelp')} {...register('coordination_point_id')}>
          <option value={String(point.id)}>{point.name}</option>
        </SelectField>
      ) : (
        <p role="alert" className="type-body-m rounded-md bg-status-warning px-3 py-2.5 text-status-warning">
          {t('pointPanel.noPoint')}
        </p>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="type-label-m mb-2 text-primary">{t('fields.contactMethod')}</legend>
        <Controller
          control={control}
          name="contact_method"
          render={({ field }) => (
            <RadioGroup
              label={t('fields.contactMethod')}
              value={field.value}
              onValueChange={field.onChange}
              options={CONTACT_METHODS.map((value) => ({
                value,
                label: t(`options.contactMethod.${value}`),
                disabled: (value === 'desk_phone' && !point?.has_phone) || (value === 'desk_email' && !point?.has_email),
              }))}
            />
          )}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-2" disabled={method === 'none'}>
        <legend className="type-label-m text-primary">{t('fields.visibility')}</legend>
        <p className="type-body-s mb-1 text-secondary">{t('fields.visibilityHelp')}</p>
        <Controller
          control={control}
          name="contact_visible_to"
          render={({ field }) => (
            <RadioGroup
              label={t('fields.visibility')}
              value={field.value}
              onValueChange={field.onChange}
              disabled={method === 'none'}
              options={CONTACT_VISIBILITIES.map((value) => ({ value, label: t(`options.visibility.${value}`) }))}
            />
          )}
        />
      </fieldset>
      <TextAreaField
        label={t('fields.instructions')}
        rows={3}
        maxChars={INSTRUCTIONS_MAX}
        charCount={instructions.length}
        placeholder={t('fields.instructionsPlaceholder')}
        helperText={t('fields.instructionsHelp')}
        error={formState.errors.response_instructions?.message}
        {...register('response_instructions')}
      />
    </>
  )
}

function StepReview({
  form,
  values,
  municipality,
  point,
  closesAt,
  flags,
  goTo,
}: FormProp & {
  values: RequestFormValues
  municipality: Municipality | undefined
  point: OwnCoordinationPoint | undefined
  closesAt: string | null
  flags: string[]
  goTo: (step: Step) => void
}) {
  const { t, i18n } = useTranslation(['manage', 'request'])
  const locale = i18n.language
  const notSet = t('review.notSet')
  const neededBy = values.needed_by
    ? values.desk_window_start && values.desk_window_end
      ? t('review.neededByValue', { date: formatCalendarDate(values.needed_by, locale), from: values.desk_window_start, to: values.desk_window_end })
      : formatCalendarDate(values.needed_by, locale)
    : notSet
  const contact =
    values.contact_method === 'none'
      ? t('options.contactShort.none')
      : `${t(`options.contactShort.${values.contact_method}`)} · ${t(`options.visibilityShort.${values.contact_visible_to}`)}`

  const rows: { label: string; value: string; step: Step }[] = [
    { label: t('fields.bloodType'), value: values.blood_type ? displayBloodType(values.blood_type) : notSet, step: 1 },
    { label: t('fields.units'), value: values.units_requested || notSet, step: 1 },
    { label: t('fields.neededBy'), value: neededBy, step: 1 },
    { label: t('review.location'), value: municipality ? `${municipality.name}, ${municipality.province}` : notSet, step: 1 },
    { label: t('fields.category'), value: values.category ? t(`options.category.${values.category}` as 'options.category.scheduled_procedure') : notSet, step: 1 },
    { label: t('pointPanel.title'), value: point?.name ?? notSet, step: 2 },
    { label: t('review.contact'), value: contact, step: 2 },
    {
      label: t('review.expires'),
      value: closesAt ? t('review.expiresValue', { date: formatDate(closesAt, locale), time: formatTime(closesAt, locale) }) : notSet,
      step: 1,
    },
  ]

  const personalFlagged = flags.length > 0
  const checks = [
    { ok: true, text: t('review.checks.address') },
    { ok: !personalFlagged, text: personalFlagged ? t('review.checks.personalFlagged') : t('review.checks.personal') },
    { ok: true, text: t('review.checks.desk') },
  ]
  const confirmError = form.formState.errors.confirmed?.message

  return (
    <>
      <dl className="overflow-hidden rounded-lg border border-default">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-4 border-b border-default px-3 py-2.5 last:border-b-0 max-sm:flex-wrap">
            <dt className="type-body-s w-30 shrink-0 pt-px text-secondary">{row.label}</dt>
            <dd className="type-body-m min-w-0 flex-1 text-primary">{row.value}</dd>
            <dd>
              <button
                type="button"
                onClick={() => goTo(row.step)}
                aria-label={t('review.editField', { field: row.label })}
                className="type-label-m rounded-sm text-link hover:underline"
              >
                {t('review.edit')}
              </button>
            </dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <h3 className="type-h4 text-primary">{t('review.privacy')}</h3>
        <ul className="flex flex-col gap-2 rounded-lg bg-canvas p-3">
          {checks.map((check) => (
            <li key={check.text} className={`type-body-s flex items-start gap-2 ${check.ok ? 'text-primary' : 'text-status-warning'}`}>
              {check.ok ? (
                <CheckCircle aria-hidden size={16} className="mt-px shrink-0 text-status-success" />
              ) : (
                <AlertTriangle aria-hidden size={16} className="mt-px shrink-0" />
              )}
              {check.text}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-1.5">
        <Controller
          control={form.control}
          name="confirmed"
          render={({ field }) => (
            <Checkbox
              label={t('review.confirm')}
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked === true)
                if (checked === true) form.clearErrors('confirmed')
              }}
              ref={field.ref}
              aria-invalid={confirmError ? true : undefined}
              aria-describedby={confirmError ? 'confirm-error' : undefined}
            />
          )}
        />
        {confirmError && (
          <p id="confirm-error" className="type-body-s pl-7 text-status-critical">
            {confirmError}
          </p>
        )}
      </div>

      <p className="type-body-s flex gap-2 text-secondary">
        <ShieldCheck aria-hidden size={16} className="mt-px shrink-0" />
        {t('review.roleNote')}
      </p>
    </>
  )
}
