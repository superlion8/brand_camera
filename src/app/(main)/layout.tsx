import { BottomNav } from "@/components/shared/BottomNav"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-primary">
      <main className="mb-nav">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}

