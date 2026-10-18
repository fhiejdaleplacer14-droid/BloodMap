import { RadioGroup } from 'radix-ui'
import { cn } from '../../lib/cn'
import { icons, type IconName } from './icons'

type Segment<T extends string> = { value: T; label: string; icon?: IconName }

type SegmentedControlProps<T extends string> = {
  value: T
  onValueChange: (value: T) => void
  segments: Segment<T>[]
  /** Accessible name of the group. */
  label: string
  className?: string
}

/**
 * Segment (8:202): 2–3 segments in a bg/subtle track (padding 4, radius 8).
 * role="radiogroup". Used for the mobile List ⇄ Map switch.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  segments,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      orientation="horizontal"
      className={cn('inline-flex w-fit gap-1 rounded-md bg-subtle p-1', className)}
    >
      {segments.map((segment) => {
        const Icon = segment.icon ? icons[segment.icon] : null
        return (
          <RadioGroup.Item
            key={segment.value}
            value={segment.value}
            className={cn(
              'type-label-m inline-flex h-9 items-center justify-center gap-1.5 rounded-sm px-3 text-secondary transition-colors duration-150',
              'data-[state=checked]:bg-surface data-[state=checked]:text-primary data-[state=checked]:shadow-raised',
            )}
          >
            {Icon && <Icon aria-hidden size={16} />}
            {segment.label}
          </RadioGroup.Item>
        )
      })}
    </RadioGroup.Root>
  )
}
