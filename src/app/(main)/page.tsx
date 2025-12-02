"use client"

import Image from "next/image"
import Link from "next/link"
import { Camera, Wand2, FolderHeart, Images, ArrowRight, Lightbulb, Users, Sparkles } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { useTranslation } from "@/stores/languageStore"
import { UserMenu } from "@/components/shared/UserMenu"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"

export default function HomePage() {
  const { generations, _hasHydrated } = useAssetStore()
  const { t } = useTranslation()
  
  // Get recent generations (last 4)
  const recentGenerations = generations.slice(0, 4)
  
  return (
    <div className="min-h-full bg-zinc-50 pb-32">
      {/* Hero Section */}
      <div className="bg-white px-6 pt-8 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Image src="/logo.png" alt="Brand Camera" width={48} height={48} className="rounded-xl" />
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">{t.common.appName}</h1>
              <p className="text-sm text-zinc-500">{t.common.slogan}</p>
            </div>
          </div>
          <UserMenu />
        </div>
        
        <p className="text-zinc-600 leading-relaxed text-sm">
          {t.home.description}
        </p>
      </div>
      
      {/* Feature Cards - Horizontal layout with before-after */}
      <div className="px-4 -mt-4 space-y-3">
        {/* 模特影棚 Card */}
        <Link href="/camera" className="block">
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden">
            <div className="flex-1 z-10">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-100" />
                <h3 className="font-bold">{t.home.modelStudio}</h3>
              </div>
              <p className="text-blue-100 text-xs leading-relaxed">
                {t.home.modelStudioDesc}
              </p>
            </div>
            {/* Before-After Preview with real images */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-14 h-[72px] rounded-lg overflow-hidden border-2 border-blue-300/50 shadow-md">
                <Image 
                  src="/homepage/before.jpg" 
                  alt="商品" 
                  width={56} 
                  height={72} 
                  className="w-full h-full object-cover"
                />
              </div>
              <ArrowRight className="w-4 h-4 text-blue-200" />
              <div className="w-14 h-[72px] rounded-lg overflow-hidden border-2 border-white/50 shadow-md">
                <Image 
                  src="/homepage/after1.png" 
                  alt="模特图1" 
                  width={56} 
                  height={72} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-14 h-[72px] rounded-lg overflow-hidden border-2 border-white/50 shadow-md">
                <Image 
                  src="/homepage/after2.png" 
                  alt="模特图2" 
                  width={56} 
                  height={72} 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </Link>
        
        {/* 商品影棚 Card */}
        <Link href="/studio" className="block">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden">
            <div className="flex-1 z-10">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-5 h-5 text-amber-100" />
                <h3 className="font-bold">{t.home.productStudio}</h3>
              </div>
              <p className="text-amber-100 text-xs leading-relaxed">
                {t.home.productStudioDesc}
              </p>
            </div>
            {/* Before-After Preview */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-14 h-[72px] rounded-lg bg-amber-700/50 overflow-hidden flex items-center justify-center border-2 border-amber-300/50 shadow-md">
                <div className="text-center">
                  <div className="w-8 h-10 mx-auto bg-amber-200/30 rounded" />
                  <span className="text-[9px] text-amber-100 mt-1 block">商品</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-amber-200" />
              <div className="w-14 h-[72px] rounded-lg bg-amber-600/50 overflow-hidden flex items-center justify-center border-2 border-white/50 shadow-md">
                <div className="text-center">
                  <Sparkles className="w-6 h-6 mx-auto text-amber-100" />
                  <span className="text-[9px] text-amber-100 mt-1 block">影棚照</span>
                </div>
              </div>
            </div>
          </div>
        </Link>
        
        {/* 修图室 Card */}
        <Link href="/edit" className="block">
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-2xl p-4 flex items-center gap-3 relative overflow-hidden">
            <div className="flex-1 z-10">
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="w-5 h-5 text-purple-200" />
                <h3 className="font-bold">{t.home.editRoom}</h3>
              </div>
              <p className="text-purple-200 text-xs leading-relaxed">
                {t.home.editRoomDesc}
              </p>
            </div>
            {/* Before-After Preview */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-14 h-[72px] rounded-lg bg-purple-800/50 overflow-hidden flex items-center justify-center border-2 border-purple-300/50 shadow-md">
                <div className="text-center">
                  <div className="w-8 h-10 mx-auto bg-purple-300/30 rounded" />
                  <span className="text-[9px] text-purple-200 mt-1 block">原图</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-300" />
              <div className="w-14 h-[72px] rounded-lg bg-purple-600/50 overflow-hidden flex items-center justify-center border-2 border-white/50 shadow-md">
                <div className="text-center">
                  <Wand2 className="w-6 h-6 mx-auto text-purple-200" />
                  <span className="text-[9px] text-purple-200 mt-1 block">修图后</span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>
      
      {/* Navigation Cards */}
      <div className="px-4 mt-6">
        <div className="space-y-3">
          <Link href="/brand-assets" className="flex items-center justify-between bg-white rounded-xl p-4 border border-zinc-100 active:bg-zinc-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
                <FolderHeart className="w-5 h-5 text-zinc-600" />
              </div>
              <div>
                <h3 className="font-medium text-zinc-900">{t.assets.title}</h3>
                <p className="text-xs text-zinc-500">{t.common.model}、{t.common.background}、{t.common.product}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-zinc-400" />
          </Link>
          
          <Link href="/gallery" className="flex items-center justify-between bg-white rounded-xl p-4 border border-zinc-100 active:bg-zinc-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
                <Images className="w-5 h-5 text-zinc-600" />
              </div>
              <div>
                <h3 className="font-medium text-zinc-900">{t.nav.gallery}</h3>
                <p className="text-xs text-zinc-500">{t.gallery.favorites}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-zinc-400" />
          </Link>
        </div>
      </div>
      
      {/* My Gallery */}
      {_hasHydrated && recentGenerations.length > 0 && (
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase">{t.home.myGallery}</h2>
            <Link href="/gallery" className="text-xs text-blue-600 font-medium">{t.home.viewAll}</Link>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {recentGenerations.map((gen) => (
              <Link key={gen.id} href="/gallery" className="aspect-square rounded-lg overflow-hidden bg-zinc-200">
                <Image
                  src={gen.outputImageUrls[0]}
                  alt="Generated"
                  width={100}
                  height={100}
                  className="w-full h-full object-cover"
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
