import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { IconButton } from '../ui/IconButton'

/**
 * Task header below 1024 px (44:960 · 44:1039): back arrow and the page
 * title replace the app top bar on focused flows (route handle `focus`).
 */
export function MobilePageHeader({ title, backTo, backLabel, actions }: { title: string; backTo: string; backLabel: string; actions?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-1 border-b border-default bg-surface px-2 lg:hidden">
      <IconButton icon="arrow-left" label={backLabel} tooltip={false} onClick={() => navigate(backTo)} />
      <h1 className="type-h4 min-w-0 flex-1 truncate text-primary">{title}</h1>
      {actions}
    </div>
  )
}
