"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, FolderHeart, Images, Wand2, Users, Lightbulb } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { useTranslation } from "@/stores/languageStore"
import { UserMenu } from "@/components/shared/UserMenu"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"
import { QuotaIndicator } from "@/components/shared/QuotaIndicator"
import { SyncIndicator } from "@/components/shared/SyncIndicator"
import { BeforeAfterSlider } from "@/components/shared/BeforeAfterSlider"

// Supabase Storage base URL for homepage images
const HOMEPAGE_STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/homepage'

// Feature card component with before-after slider
function FeatureCard({
  href,
  beforeImage,
  afterImage,
  icon: Icon,
  title,
  subtitle,
  height = 200,
}: {
  href: string
  beforeImage: string
  afterImage: string
  icon: React.ElementType
  title: string
  subtitle: string
  height?: number
}) {
  return (
    <Link href={href} className="block">
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-zinc-100">
        {/* Image */}
        <BeforeAfterSlider
          beforeImage={beforeImage}
          afterImage={afterImage}
          height={height}
          className="rounded-t-2xl rounded-b-none"
        />
        {/* Title below image */}
        <div className="p-2.5">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-zinc-100 rounded-full flex items-center justify-center shrink-0">
              <Icon className="w-3 h-3 text-zinc-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-zinc-900 text-sm truncate">{title}</h3>
              <p className="text-zinc-500 text-[10px] truncate">{subtitle}</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function HomePage() {
  const { generations, _hasHydrated } = useAssetStore()
  const { t } = useTranslation()
  
  // Get recent generations (last 4)
  const recentGenerations = generations.slice(0, 4)
  
  return (
    <div className="min-h-full bg-zinc-50 pb-32">
      {/* Hero Section */}
      <div className="bg-white px-4 pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Image src="/logo.png" alt="Brand Camera" width={28} height={28} className="rounded-md" />
            <div className="flex items-center gap-1">
              <h1 className="text-base font-bold text-zinc-900">{t.common.appName}</h1>
              <span className="px-1 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] font-medium rounded">
                {t.beta.tag}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <SyncIndicator />
            <QuotaIndicator />
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </div>
      </div>
      
      {/* Main Feature Cards - 2 columns */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Model Studio */}
          <FeatureCard
            href="/camera"
            beforeImage={`${HOMEPAGE_STORAGE_URL}/model-before.jpg`}
            afterImage={`${HOMEPAGE_STORAGE_URL}/model-after.png`}
            icon={Users}
            title={t.home.modelStudio}
            subtitle={t.home.modelStudioSubtitle}
            height={220}
          />
          
          {/* Product Studio */}
          <FeatureCard
            href="/studio"
            beforeImage={`${HOMEPAGE_STORAGE_URL}/product-before.jpg`}
            afterImage={`${HOMEPAGE_STORAGE_URL}/product-after.jpg`}
            icon={Lightbulb}
            title={t.home.productStudio}
            subtitle={t.home.productStudioSubtitle}
            height={220}
          />
        </div>
        
        {/* Edit Room */}
        <Link href="/edit/general" className="block mt-3">
          <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Wand2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">{t.home.editRoom}</h3>
                <p className="text-white/80 text-xs">{t.home.editRoomDesc}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white/80" />
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
            {recentGenerations.map((gen) => {
              const imageUrl = gen.outputImageUrls?.[0]
              if (!imageUrl) return null
              return (
                <Link key={gen.id} href="/gallery" className="aspect-square rounded-lg overflow-hidden bg-zinc-200">
                  <Image
                    src={imageUrl}
                    alt="Generated"
                    width={100}
                    height={100}
                    className="w-full h-full object-cover"
                  />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
