'use client'

import Link from 'next/link'
import Image from 'next/image'

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-zinc-50/80 backdrop-blur-xl border-b border-zinc-200/50">
      <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Brand Camera"
            width={36}
            height={36}
            className="rounded-xl"
          />
          <span className="text-xl font-bold tracking-tight text-zinc-900">Brand Camera</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Features</a>
          <a href="#showcase" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Showcase</a>
          <a href="#pricing" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Pricing</a>
        </div>
        
        <div className="flex items-center gap-3">
          <Link 
            href="/login"
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Sign In
          </Link>
          <Link 
            href="/app"
            className="px-5 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-full hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/10"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  )
}
