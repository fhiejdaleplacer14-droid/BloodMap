import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { icons, type IconName } from '../ui/icons'

export type BottomNavItem = { to: string; label: string; icon: IconName; end?: boolean }

/**
 * Bottom navigation (8:272 · 54:343): mobile signed-in screens, max 5 items,
 * 72×56 each (≥ 44 px targets), labels always visible. 81 high.
 */
export function BottomNav({ items, className }: { items: BottomNavItem[]; className?: string }) {
  const { t } = useTranslation('nav')
  return (
    <nav aria-label={t('bottom.label')} className={cn('border-t border-default bg-surface px-2 pt-1.5 pb-[18px]', className)}>
      <ul className="flex justify-between">
        {items.slice(0, 5).map((item) => {
          const Icon = icons[item.icon]
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className="group flex h-14 w-[72px] flex-col items-center justify-center gap-1 rounded-md"
              >
                <span className="flex h-7 w-12 items-center justify-center rounded-md text-secondary group-aria-[current=page]:bg-brand-soft group-aria-[current=page]:text-brand">
                  <Icon aria-hidden size={20} />
                </span>
                <span className="type-label-s text-secondary group-aria-[current=page]:text-primary">{item.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
