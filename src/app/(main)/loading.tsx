import { Skeleton, SkeletonCard, SkeletonText, SkeletonTitle, SkeletonButton } from '@/components/ui/Skeleton'

export default function MainLoading() {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Mobile Header Skeleton */}
      <div className="lg:hidden">
        <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-100 bg-white">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 lg:p-8 max-w-5xl mx-auto">
        {/* Title Section */}
        <div className="mb-6">
          <SkeletonTitle className="mb-2" />
          <SkeletonText className="w-64" />
        </div>

        {/* Upload Area Skeleton */}
        <div className="mb-6">
          <Skeleton className="h-48 lg:h-64 w-full rounded-2xl" />
        </div>

        {/* Options Grid Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} className="h-24" />
          ))}
        </div>

        {/* Secondary Section */}
        <div className="space-y-4">
          <SkeletonText className="w-24" />
          <div className="grid grid-cols-4 lg:grid-cols-6 gap-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>

        {/* Bottom Button Skeleton */}
        <div className="mt-8">
          <SkeletonButton />
        </div>
      </div>

      {/* Mobile Bottom Nav Skeleton */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-zinc-100">
        <div className="flex items-center justify-around h-full px-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
