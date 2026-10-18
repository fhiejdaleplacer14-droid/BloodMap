import { cn } from '../../lib/cn'

/**
 * Skeleton bone (10:547): bg/subtle with a 1.2 s shimmer, disabled under
 * prefers-reduced-motion. Decorative — the container sets aria-busy.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block animate-shimmer rounded-xs bg-subtle bg-[length:200%_100%]',
        'bg-[linear-gradient(90deg,var(--bg-subtle)_0%,var(--bg-canvas)_50%,var(--bg-subtle)_100%)]',
        className,
      )}
    />
  )
}
