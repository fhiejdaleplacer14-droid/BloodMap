import { cn } from '../../lib/cn'

/** Control box shared by every field: 40 high, radius 8, focus = 2 px blue + ring. */
export function controlClassName({ invalid, disabled }: { invalid: boolean; disabled?: boolean }) {
  return cn(
    'relative flex h-10 w-full items-center gap-2 overflow-hidden rounded-md transition-colors duration-150',
    disabled
      ? 'border border-default bg-subtle px-3 text-tertiary'
      : invalid
        ? 'border-2 border-status-critical bg-surface px-[11px]'
        : 'border border-default bg-surface px-3 hover:border-strong',
    !disabled &&
      'focus-within:border-2 focus-within:border-focus focus-within:px-[11px] focus-within:shadow-focus',
  )
}

/** The bare <input>/<select> inside a control box. Focus is shown on the box. */
export const controlInputClassName =
  'min-w-0 flex-1 appearance-none bg-transparent outline-none placeholder:text-tertiary focus-visible:shadow-none focus-visible:outline-none disabled:cursor-not-allowed disabled:text-tertiary'
