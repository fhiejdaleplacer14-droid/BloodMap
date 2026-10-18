import type { ComponentPropsWithRef, ReactNode } from 'react'
import { Tabs as RadixTabs } from 'radix-ui'
import { cn } from '../../lib/cn'

export const Tabs = RadixTabs.Root
export const TabsContent = RadixTabs.Content

export function TabsList({ className, ...props }: ComponentPropsWithRef<typeof RadixTabs.List>) {
  return <RadixTabs.List className={cn('flex border-b border-default', className)} {...props} />
}

type TabProps = ComponentPropsWithRef<typeof RadixTabs.Trigger> & {
  children: ReactNode
  count?: number
}

/** Tab (8:185): underline tabs, 40 px. Active = 2 px ink underline (not red). */
export function Tab({ children, count, className, ...props }: TabProps) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'group type-label-m -mb-px inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-secondary transition-colors duration-150 hover:bg-subtle',
        'data-[state=active]:border-[var(--text-primary)] data-[state=active]:text-primary data-[state=active]:hover:bg-transparent',
        'focus-visible:rounded-sm',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className="type-label-s rounded-sm bg-subtle px-1.5 py-0.5 text-secondary group-data-[state=active]:bg-inverse group-data-[state=active]:text-on-inverse">
          {count}
        </span>
      )}
    </RadixTabs.Trigger>
  )
}
