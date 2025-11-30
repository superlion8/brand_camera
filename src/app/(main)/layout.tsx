import { BottomNav } from "@/components/shared/BottomNav"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-50 dark:bg-zinc-900 max-w-md mx-auto shadow-2xl overflow-hidden relative">
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative bg-white dark:bg-zinc-950">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
