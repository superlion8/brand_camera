import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-zinc-200/70',
        className
      )}
    />
  )
}

export function SkeletonText({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-4 w-full', className)} />
}

export function SkeletonTitle({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-8 w-48', className)} />
}

export function SkeletonCard({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-40 w-full rounded-2xl', className)} />
}

export function SkeletonAvatar({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />
}

export function SkeletonButton({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-12 w-full rounded-xl', className)} />
}
