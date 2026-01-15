'use client'

import Image from 'next/image'

export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-zinc-200 bg-white">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Brand Camera"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="font-semibold text-zinc-900">Brand Camera</span>
        </div>
        
        <div className="flex items-center gap-8 text-sm text-zinc-500">
          <a href="#" className="hover:text-zinc-900 transition-colors">Privacy</a>
          <a href="#" className="hover:text-zinc-900 transition-colors">Terms</a>
          <a href="#" className="hover:text-zinc-900 transition-colors">Contact</a>
        </div>
        
        <p className="text-sm text-zinc-400">© 2025 Brand Camera. All rights reserved.</p>
      </div>
    </footer>
  )
}
