import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { icons, type IconName } from './icons'

type EmptyStateProps = {
  icon: IconName
  /** neutral (empty) · warning (degraded, e.g. map) · critical (failed, e.g. network). */
  tone?: 'neutral' | 'warning' | 'critical'
  title: ReactNode
  description: ReactNode
  /** Always offer a next action (51:289). */
  actions: ReactNode
  /** role="alert" for errors that replace content. */
  role?: 'status' | 'alert'
  className?: string
}

const TILE = {
  neutral: 'bg-subtle text-secondary',
  warning: 'bg-status-warning text-status-warning',
  critical: 'bg-status-critical text-status-critical',
} as const

/**
 * Empty & Error State (10:545). Centered in its panel; explains what
 * happened AND what to do next. Never a blank screen.
 */
export function EmptyState({ icon, tone = 'neutral', title, description, actions, role, className }: EmptyStateProps) {
  const Icon = icons[icon]
  return (
    <div role={role} className={cn('mx-auto flex w-full max-w-[360px] flex-col items-center gap-3 px-6 py-8 text-center', className)}>
      <span className={cn('flex size-12 items-center justify-center rounded-lg', TILE[tone])}>
        <Icon aria-hidden size={22} />
      </span>
      <h2 className="type-h4 text-primary">{title}</h2>
      <p className="type-body-s text-secondary">{description}</p>
      <div className="flex flex-wrap justify-center gap-2 pt-1">{actions}</div>
    </div>
  )
}
