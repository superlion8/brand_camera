'use client'

import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-zinc-200 bg-white">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="BrandCam"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="font-semibold text-zinc-900">BrandCam</span>
        </div>
        
        <div className="flex items-center gap-8 text-sm text-zinc-500">
          <Link href="/privacy" className="hover:text-zinc-900 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-zinc-900 transition-colors">Terms</Link>
          <a href="mailto:support@honoululuai.com" className="hover:text-zinc-900 transition-colors">Contact</a>
        </div>
        
        <p className="text-sm text-zinc-400">© 2025 BrandCam. All rights reserved.</p>
      </div>
    </footer>
  )
}
