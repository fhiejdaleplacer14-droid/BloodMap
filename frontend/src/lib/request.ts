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

export type PublicRequest = {
  id: string
  blood_type: BloodType
  units_requested: number | null
  needed_by: string | null
  urgency: Urgency
  status: RequestStatus
  /** Municipality centroid only — never an address (decision #5). */
  location: {
    municipality: string
    province: string
    point: [number, number]
    precision: 'municipality'
  }
  coordination_point: { id: number; name: string; hours: string | null } | null
  contact: { phone: string | null } | null
  public_summary: string
  published_at: string | null
  updated_at: string
  expires_at: string | null
  is_demo: boolean
  can: { save?: boolean; report?: boolean }
}

/** Display with a true minus sign (U+2212) for legibility (5:264). */
export function displayBloodType(type: BloodType): string {
  return type.replace('-', '−')
}
