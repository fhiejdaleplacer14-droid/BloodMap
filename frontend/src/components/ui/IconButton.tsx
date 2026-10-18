import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'
import { icons, type IconName } from './icons'
import { Tooltip } from './Tooltip'

type IconButtonProps = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
  icon: IconName
  /** Required: becomes aria-label and the desktop tooltip. */
  label: string
  variant?: 'ghost' | 'outline'
  /** Hide the tooltip when the label is already visible nearby. */
  tooltip?: boolean
  iconSize?: 18 | 20
}

/** Icon Button (6:501): 40×40, 44×44 hit area on touch. */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  tooltip = true,
  iconSize = 20,
  className,
  ...props
}: IconButtonProps) {
  const Icon = icons[icon]
  const button = (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-md text-secondary transition-colors duration-150 hover:bg-subtle max-lg:size-11',
        'disabled:cursor-not-allowed disabled:text-tertiary',
        variant === 'outline' ? 'border border-default bg-surface disabled:hover:bg-surface' : 'disabled:hover:bg-transparent',
        className,
      )}
      {...props}
    >
      <Icon aria-hidden size={iconSize} />
    </button>
  )
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button
}
