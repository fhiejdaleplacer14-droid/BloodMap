import type { ReactNode } from 'react'
import { Tooltip as RadixTooltip } from 'radix-ui'

type TooltipProps = {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}

/**
 * Tooltip (8:282). Opens on hover AND keyboard focus after 300 ms; Esc
 * dismisses. Never the only place important information lives.
 */
export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={4}
          className="type-label-s z-50 rounded-sm bg-inverse px-2.5 py-1.5 text-on-inverse"
        >
          {content}
          <RadixTooltip.Arrow width={10} height={6} className="fill-(--bg-inverse)" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={300}>{children}</RadixTooltip.Provider>
}
