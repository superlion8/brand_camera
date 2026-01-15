import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// CSS animation styles (no JS required)
const fadeInUp = "animate-[fadeInUp_0.6s_ease-out_forwards]"
const fadeInUpDelay1 = "animate-[fadeInUp_0.6s_ease-out_0.1s_forwards] opacity-0"
const fadeInUpDelay2 = "animate-[fadeInUp_0.6s_ease-out_0.2s_forwards] opacity-0"
const fadeInUpDelay3 = "animate-[fadeInUp_0.6s_ease-out_0.3s_forwards] opacity-0"
const fadeInDelay5 = "animate-[fadeIn_0.6s_ease-out_0.5s_forwards] opacity-0"

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-24">
      {/* Background decorations */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 rounded-full blur-[100px]" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-200/40 rounded-full blur-[120px]" />
      <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-rose-200/20 rounded-full blur-[80px]" />
      
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-zinc-200 shadow-sm mb-8 ${fadeInUp}`}
        >
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-zinc-600">AI-Powered Product Photography</span>
        </div>
        
        <h1
          className={`text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] ${fadeInUpDelay1}`}
        >
          <span className="text-zinc-900">Transform Your</span>
          <br />
          <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 bg-clip-text text-transparent">
            Product Photos
          </span>
        </h1>
        
        <p
          className={`mt-6 text-lg md:text-xl text-zinc-500 max-w-2xl mx-auto leading-relaxed ${fadeInUpDelay2}`}
        >
          Create stunning model photos, lifestyle shots, and professional product images in seconds. 
          No photographers, no studios, no waiting.
        </p>
        
        <div
          className={`mt-10 flex items-center justify-center ${fadeInUpDelay3}`}
        >
          <Link
            href="/app"
            className="group px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-full flex items-center gap-2 shadow-xl shadow-orange-500/25 hover:shadow-2xl hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all"
          >
            Start Creating Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        
        {/* Stats */}
        <div
          className={`mt-16 flex items-center justify-center gap-12 md:gap-20 ${fadeInDelay5}`}
        >
          {[
            { value: '50K+', label: 'Photos Generated' },
            { value: '1K+', label: 'Stores Using' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-zinc-900">{stat.value}</div>
              <div className="text-sm text-zinc-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Scroll indicator - CSS only animation */}
      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 ${fadeInDelay5}`}>
        <div className="w-6 h-10 rounded-full border-2 border-zinc-300 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-zinc-400 rounded-full animate-[scrollBounce_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
    </section>
  )
}
