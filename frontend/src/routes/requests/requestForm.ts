import type { TFunction } from 'i18next'
import { z } from 'zod'
import type { ContactMethod, ContactVisibility, ManagedRequest, OwnCoordinationPoint, RequestDraft } from '../../lib/api/myRequests'
import { manilaToday } from '../../lib/dates'
import { BLOOD_TYPES, type BloodType, type Urgency } from '../../lib/request'

export const SUMMARY_MAX = 280
export const INSTRUCTIONS_MAX = 400
const DEFAULT_WINDOW_END = '17:00'

export type RequestFormValues = {
  blood_type: BloodType | ''
  units_requested: string
  needed_by: string
  desk_window_start: string
  desk_window_end: string
  province: string
  municipality_id: string
  category: string
  public_summary: string
  coordination_point_id: string
  contact_method: ContactMethod
  contact_visible_to: ContactVisibility
  response_instructions: string
  confirmed: boolean
}

export type Step = 1 | 2 | 3

/** Fields validated before leaving each step. */
export const STEP_FIELDS: Record<Step, (keyof RequestFormValues)[]> = {
  1: ['blood_type', 'units_requested', 'needed_by', 'desk_window_start', 'desk_window_end', 'municipality_id', 'category', 'public_summary'],
  2: ['coordination_point_id', 'contact_method', 'contact_visible_to', 'response_instructions'],
  3: [],
}

/** Which step a server field error belongs to. */
export function stepOf(field: string): Step {
  return STEP_FIELDS[2].includes(field as keyof RequestFormValues) ? 2 : 1
}

export function requestSchema(t: TFunction<'manage'>) {
  return z
    .object({
      blood_type: z.union([z.enum(BLOOD_TYPES), z.literal('')]).refine((v) => v !== '', t('errors.bloodType')),
      units_requested: z.string().refine((v) => v === '' || (/^\d+$/.test(v) && +v >= 1 && +v <= 50), t('errors.units')),
      needed_by: z
        .string()
        .min(1, t('errors.neededBy'))
        .refine((v) => v === '' || v >= manilaToday(), t('errors.pastDate')),
      desk_window_start: z.string(),
      desk_window_end: z.string(),
      province: z.string(),
      municipality_id: z.string().min(1, t('errors.municipality')),
      category: z.string(),
      public_summary: z
        .string()
        .refine((v) => v.trim() !== '', t('errors.summary'))
        .refine((v) => v.length <= SUMMARY_MAX, t('errors.tooLong', { max: SUMMARY_MAX })),
      coordination_point_id: z.string(),
      contact_method: z.enum(['desk_phone', 'desk_email', 'none']),
      contact_visible_to: z.enum(['signed_in', 'public', 'coordinators']),
      response_instructions: z.string().refine((v) => v.length <= INSTRUCTIONS_MAX, t('errors.tooLong', { max: INSTRUCTIONS_MAX })),
      confirmed: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const start = v.desk_window_start
      const end = v.desk_window_end
      if ((start || end) && (!start || !end || end <= start)) {
        ctx.addIssue({ code: 'custom', path: [start ? 'desk_window_end' : 'desk_window_start'], message: t('errors.window') })
      }
    })
}

/** Sensible starting point: the submitter's own desk and its municipality. */
export function emptyValues(point: OwnCoordinationPoint | undefined): RequestFormValues {
  return {
    blood_type: '',
    units_requested: '',
    needed_by: '',
    desk_window_start: '',
    desk_window_end: '',
    province: point?.municipality.province ?? '',
    municipality_id: point ? String(point.municipality.id) : '',
    category: '',
    public_summary: '',
    coordination_point_id: point ? String(point.id) : '',
    contact_method: point?.has_phone ? 'desk_phone' : point?.has_email ? 'desk_email' : 'none',
    contact_visible_to: 'signed_in',
    response_instructions: '',
    confirmed: false,
  }
}

export function fromRequest(request: ManagedRequest): RequestFormValues {
  return {
    blood_type: request.blood_type,
    units_requested: request.units_requested ? String(request.units_requested) : '',
    needed_by: request.needed_by ?? '',
    desk_window_start: request.desk_window?.[0] ?? '',
    desk_window_end: request.desk_window?.[1] ?? '',
    province: request.location.province,
    municipality_id: String(request.municipality_id),
    category: request.category ?? '',
    public_summary: request.public_summary ?? '',
    coordination_point_id: String(request.coordination_point.id),
    contact_method: request.contact_method,
    contact_visible_to: request.contact_visible_to,
    response_instructions: request.response_instructions ?? '',
    confirmed: false,
  }
}

const orNull = (v: string) => (v.trim() === '' ? null : v.trim())

export function toDraft(v: RequestFormValues): Partial<RequestDraft> {
  return {
    ...(v.blood_type ? { blood_type: v.blood_type } : {}),
    ...(v.municipality_id ? { municipality_id: Number(v.municipality_id) } : {}),
    ...(v.coordination_point_id ? { coordination_point_id: Number(v.coordination_point_id) } : {}),
    units_requested: v.units_requested ? Number(v.units_requested) : null,
    needed_by: orNull(v.needed_by),
    desk_window_start: orNull(v.desk_window_start),
    desk_window_end: orNull(v.desk_window_end),
    category: orNull(v.category),
    public_summary: orNull(v.public_summary),
    contact_method: v.contact_method,
    contact_visible_to: v.contact_visible_to,
    response_instructions: orNull(v.response_instructions),
  }
}

/** When the desk window closes on the needed-by date (Manila) — the automatic expiry. */
export function windowClosesAt(neededBy: string, windowEnd: string): string | null {
  if (!neededBy) return null
  return new Date(`${neededBy}T${windowEnd || DEFAULT_WINDOW_END}:00+08:00`).toISOString()
}

/** Mirrors BloodRequest::deriveUrgency — the server sets the real value on submit. */
export function deriveUrgency(closesAt: string | null, now: Date = new Date()): Urgency {
  if (!closesAt) return 'scheduled'
  const hours = (new Date(closesAt).getTime() - now.getTime()) / 3_600_000
  if (hours <= 24) return 'within_24h'
  if (hours <= 72) return 'within_72h'
  return 'scheduled'
}

/** Statuses whose details the owner can still change from the wizard. */
export const EDITABLE_IN_WIZARD: ReadonlySet<ManagedRequest['status']> = new Set(['draft', 'needs_correction'])

export function wizardHref(request: Pick<ManagedRequest, 'id' | 'status'>): string {
  return `/requests/new?step=${request.status === 'draft' ? 1 : 3}&id=${encodeURIComponent(request.id)}`
}
