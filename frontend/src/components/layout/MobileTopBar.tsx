import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { Logo } from '../domain/Logo'
import { IconButton } from '../ui/IconButton'

type MobileTopBarProps =
  | {
      /** Public / Signed in: logo + trailing actions (menu, notifications). */
      variant?: 'brand'
      actions: ReactNode
      homeTo?: string
      className?: string
    }
  | {
      /** Back: drill-down screens (e.g. Request details). */
      variant: 'back'
      title: string
      onBack: () => void
      actions?: ReactNode
      className?: string
    }

/** Mobile Top Bar (12:582): 56 px, below 1024 px. */
export function MobileTopBar(props: MobileTopBarProps) {
  const { t } = useTranslation()
  const base = 'flex h-14 items-center justify-between border-b border-default bg-surface pr-2'

  if (props.variant === 'back') {
    return (
      <header className={cn(base, 'pl-1', props.className)}>
        <div className="flex min-w-0 items-center gap-1">
          <IconButton icon="arrow-left" label={t('actions.back')} tooltip={false} onClick={props.onBack} />
          <h1 className="type-h4 truncate text-primary">{props.title}</h1>
        </div>
        <div className="flex items-center gap-1">{props.actions}</div>
      </header>
    )
  }

  return (
    <header className={cn(base, 'pl-4', props.className)}>
      <Link to={props.homeTo ?? '/'} className="rounded-sm">
        <Logo size="sm" />
      </Link>
      <div className="flex items-center gap-1">{props.actions}</div>
    </header>
  )
}
