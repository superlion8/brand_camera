import Link from 'next/link'
import Image from 'next/image'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 - Page Not Found | BrandCam',
  description: 'The page you are looking for does not exist.',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white flex flex-col items-center justify-center px-6 py-24">
      {/* Logo */}
      <Link href="/" className="mb-8">
        <Image
          src="/logo.png"
          alt="BrandCam"
          width={48}
          height={48}
          className="rounded-xl"
        />
      </Link>

      {/* 404 Illustration */}
      <div className="relative mb-8">
        <div className="text-[160px] md:text-[200px] font-bold text-zinc-100 select-none leading-none">
          404
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-6xl animate-bounce">📸</div>
        </div>
      </div>

      {/* Message */}
      <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-3 text-center">
        Page Not Found
      </h1>
      <p className="text-zinc-500 text-center max-w-md mb-8">
        Oops! The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Let&apos;s get you back on track.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors text-center"
        >
          Back to Home
        </Link>
        <Link
          href="/app"
          className="px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-xl transition-colors text-center"
        >
          Go to App
        </Link>
      </div>

      {/* Quick Links */}
      <div className="mt-12 text-center">
        <p className="text-sm text-zinc-400 mb-3">Or try these popular features:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { href: '/pro-studio', label: 'Pro Studio' },
            { href: '/lifestyle', label: 'Lifestyle' },
            { href: '/try-on', label: 'Virtual Try-On' },
            { href: '/pricing', label: 'Pricing' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 text-sm text-zinc-600 hover:text-orange-500 bg-zinc-100 hover:bg-orange-50 rounded-full transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
