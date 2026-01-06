'use client'

import { ReactNode } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { BottomNav } from '@/components/shared/BottomNav'
import { Sidebar } from '@/components/layouts/Sidebar'
import { TopNav } from '@/components/layouts/TopNav'

interface ResponsiveLayoutProps {
  children: ReactNode
}

/**
 * Responsive layout component that renders:
 * - Mobile layout (BottomNav) for mobile devices
 * - Desktop layout (Sidebar + TopNav) for desktop devices
 */
export function ResponsiveLayout({ children }: ResponsiveLayoutProps) {
  const isMobile = useIsMobile(1024) // Use 1024px as breakpoint for tablet/desktop

  // During SSR or initial load, show a minimal loading state to prevent layout shift
  if (isMobile === null) {
    return (
      <div className="flex flex-col h-[100dvh] bg-zinc-50">
        <div className="flex-1 overflow-y-auto relative bg-white">
          {children}
        </div>
      </div>
    )
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-[100dvh] bg-zinc-50 max-w-md mx-auto shadow-2xl relative">
        <div className="flex-1 overflow-y-auto relative bg-white">
          {children}
        </div>
        <BottomNav />
      </div>
    )
  }

  // Desktop Layout
  return (
    <div className="flex h-screen bg-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <Sidebar className="w-64 shrink-0" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <TopNav />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-zinc-50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

