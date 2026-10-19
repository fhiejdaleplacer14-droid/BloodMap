/** Only same-site paths are honoured as ?next= targets (no open redirects). */
export function safeNext(next: string | null, fallback = '/requests'): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}

/** "j•••@example.org" (23:981). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  return domain ? `${local.slice(0, 1)}•••@${domain}` : email
}

/** Same rules as the API (AuthController::passwordRule, 23:653). */
export const passwordChecks = {
  length: (value: string) => value.length >= 12,
  case: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value),
  number: (value: string) => /[\d\W_]/.test(value),
}

export function meetsPasswordRules(value: string): boolean {
  return Object.values(passwordChecks).every((check) => check(value))
}

/** Laravel's breached-password message (Password::uncompromised). */
export const isBreachedPasswordMessage = (message: string) => /leak|compromised/i.test(message)
