import { BottomNav } from "@/components/shared/BottomNav"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-50 max-w-md mx-auto shadow-2xl relative">
      {/* Main Content Area - scrollable */}
      <div className="flex-1 overflow-y-auto relative bg-white">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
