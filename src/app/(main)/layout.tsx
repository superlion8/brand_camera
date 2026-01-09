import { ResponsiveLayout } from "@/components/layouts/ResponsiveLayout"
import { VersionChecker } from "@/components/shared/VersionChecker"
import { FlyToGallery } from "@/components/shared/FlyToGallery"
import { GalleryPreloader } from "@/components/shared/GalleryPreloader"
import { DailyRewardToast } from "@/components/shared/DailyRewardToast"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ResponsiveLayout>
        {children}
      </ResponsiveLayout>
      <VersionChecker />
      {/* Fly to gallery animation */}
      <FlyToGallery />
      {/* Silent preload gallery data */}
      <GalleryPreloader />
      {/* Daily login reward toast */}
      <DailyRewardToast />
    </>
  )
}
