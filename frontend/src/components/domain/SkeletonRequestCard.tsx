import { Skeleton } from '../ui/Skeleton'

/**
 * Skeleton · Request Card (10:547). First load only (≥ 300 ms); refetches
 * keep existing cards. The list container sets aria-busy="true".
 */
export function SkeletonRequestCard() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-3 rounded-lg border border-default bg-surface p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-13 rounded-md" />
        <div className="flex flex-col gap-2 pt-1">
          <Skeleton className="h-3 w-45" />
          <Skeleton className="h-3 w-60 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-2.5 w-full" />
      <Skeleton className="h-2.5 w-70 max-w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-27.5 rounded-sm" />
        <Skeleton className="h-5 w-22.5 rounded-sm" />
      </div>
    </div>
  )
}
