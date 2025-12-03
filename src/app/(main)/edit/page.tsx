"use client"

import Image from "next/image"
import Link from "next/link"
import { Wand2, Lightbulb, Home, Sparkles, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLanguageStore } from "@/stores/languageStore"

export default function EditHubPage() {
  const router = useRouter()
  const t = useLanguageStore(state => state.t)
  
  // Feature cards with translations
  const FEATURE_CARDS = [
    {
      id: 'general',
      title: t.edit.generalEdit,
      subtitle: t.edit.generalEditDesc,
      description: t.edit.generalEditExamples,
      icon: Wand2,
      href: '/edit/general',
      gradient: 'from-violet-500 to-purple-600',
      shadowColor: 'shadow-purple-200',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      id: 'studio',
      title: t.edit.productStudioCard,
      subtitle: t.edit.productStudioCardDesc,
      description: t.edit.productStudioExamples,
      icon: Lightbulb,
      href: '/studio',
      gradient: 'from-amber-500 to-orange-500',
      shadowColor: 'shadow-amber-200',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
  ]

  // Coming soon features with translations
  const COMING_SOON = [
    { title: t.edit.comingModelStyle, icon: '👤' },
    { title: t.edit.comingPose, icon: '🕺' },
    { title: t.edit.comingExpression, icon: '😊' },
    { title: t.edit.comingCamera, icon: '📷' },
  ]
  
  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
      <div className="h-14 border-b bg-white flex items-center px-4 shrink-0">
        <button
          onClick={() => router.push("/")}
          className="w-10 h-10 -ml-2 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"
        >
          <Home className="w-5 h-5 text-zinc-600" />
        </button>
        <div className="flex items-center gap-2 ml-2">
          <Image src="/logo.png" alt="Brand Camera" width={28} height={28} className="rounded" />
          <span className="font-semibold text-lg text-zinc-900">{t.edit.editRoom}</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900">{t.edit.title}</h1>
          </div>
        </div>
        
        {/* Feature Cards */}
        <div className="px-4 py-6 space-y-4">
          {FEATURE_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.id}
                href={card.href}
                className={`block bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm ${card.shadowColor} hover:shadow-md transition-all active:scale-[0.98]`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-7 h-7 ${card.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-lg text-zinc-900">{card.title}</h3>
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    </div>
                    <p className="text-sm font-medium text-zinc-600 mb-1">{card.subtitle}</p>
                    <p className="text-xs text-zinc-400">{card.description}</p>
                  </div>
                </div>
                
                {/* Gradient bar */}
                <div className={`mt-4 h-1.5 rounded-full bg-gradient-to-r ${card.gradient} opacity-80`} />
              </Link>
            )
          })}
        </div>
        
        {/* Coming Soon Section */}
        <div className="px-4 pb-6">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase mb-3">{t.edit.comingSoon}</h2>
          <div className="grid grid-cols-2 gap-3">
            {COMING_SOON.map((item) => (
              <div
                key={item.title}
                className="bg-white/60 border border-zinc-100 rounded-xl p-4 flex items-center gap-3 opacity-60"
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-sm font-medium text-zinc-500">{item.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
