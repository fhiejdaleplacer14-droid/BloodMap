/**
 * Request domain types — mirror the public request resource (Handoff 51:485)
 * and the enum decisions in docs/decisions.md.
 */

export const REQUEST_STATUSES = [
  'draft',
  'pending_review',
  'needs_correction',
  'active',
  'fulfilled',
  'closed',
  'expired',
  'rejected',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

/** Requester-stated time window — never a triage level (5:222). */
export const URGENCIES = ['within_24h', 'within_72h', 'scheduled'] as const
export type Urgency = (typeof URGENCIES)[number]

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
export type BloodType = (typeof BLOOD_TYPES)[number]

/** Statuses that must never read as live (5:202). */
export const RECEDED_STATUSES: ReadonlySet<RequestStatus> = new Set(['closed', 'expired', 'rejected'])

/** Provinces of NIR — the Explorer "Area" filter (25:625). */
export const PROVINCES = ['Negros Occidental', 'Negros Oriental', 'Siquijor'] as const
export type Province = (typeof PROVINCES)[number]

/** Desk phone or email of the coordination point, gated by the server (decision #19). */
export type RequestContact = { method: 'phone' | 'email'; value: string; masked: boolean }

export type PublicRequest = {
  id: string
  blood_type: BloodType
  units_requested: number | null
  /** YYYY-MM-DD (Manila). */
  needed_by: string | null
  /** ["08:00", "17:00"] */
  desk_window: [string, string] | null
  urgency: Urgency
  category: string | null
  status: RequestStatus
  /** Municipality centroid only — never an address (decision #5). */
  location: {
    municipality: string
    province: Province
    /** [lng, lat] */
    point: [number, number]
    precision: 'municipality'
  }
  coordination_point: { id: number; name: string; hours: string | null }
  contact: RequestContact | null
  public_summary: string
  response_instructions: string | null
  published_at: string | null
  updated_at: string
  expires_at: string | null
  is_demo: boolean
  is_saved: boolean
  can: { save: boolean; report: boolean; reveal_contact?: boolean }
}

/** Display with a true minus sign (U+2212) for legibility (5:264). */
export function displayBloodType(type: BloodType): string {
  return type.replace('-', '−')
}
