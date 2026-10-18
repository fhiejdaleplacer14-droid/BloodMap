import { NavLink } from 'react-router'
import { cn } from '../../lib/cn'
import { icons, type IconName } from '../ui/icons'

export type SidebarItem = {
  to: string
  label: string
  icon: IconName
  /** Only for actionable queues (e.g. pending reviews). */
  count?: number
  /** Match only the exact path (for index routes like /app). */
  end?: boolean
}

/**
 * Sidebar Nav Item (8:252): 40 high. Active = raised surface tile + crimson
 * icon (the only red in the sidebar), aria-current="page".
 */
export function SidebarNavItem({ to, label, icon, count, end }: SidebarItem) {
  const Icon = icons[icon]
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group type-label-m flex h-10 w-full items-center gap-3 rounded-md border px-3 transition-colors duration-150',
          isActive
            ? 'border-default bg-surface text-primary shadow-raised'
            : 'border-transparent text-secondary hover:bg-subtle',
        )
      }
    >
      <Icon aria-hidden size={18} className="shrink-0 group-aria-[current=page]:text-brand" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="type-label-s rounded-sm bg-subtle px-1.5 py-0.5 text-secondary">{count}</span>
      )}
    </NavLink>
  )
}
