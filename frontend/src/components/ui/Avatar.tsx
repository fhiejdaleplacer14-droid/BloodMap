import { cn } from '../../lib/cn'

type AvatarProps = {
  /** Initials only — no profile photos are collected. */
  initials: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: 'size-7 type-label-s',
  md: 'size-9 type-label-m',
  lg: 'size-14 type-h3',
} as const

/** Avatar (8:280): neutral so avatars never imply status. Decorative. */
export function Avatar({ initials, size = 'sm', className }: AvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-default bg-subtle text-secondary',
        SIZES[size],
        className,
      )}
    >
      {initials}
    </span>
  )
}
