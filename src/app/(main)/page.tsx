"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, FolderHeart, Images, Wand2, Users, Lightbulb, Smile, Move, Camera, Focus } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { useTranslation } from "@/stores/languageStore"
import { UserMenu } from "@/components/shared/UserMenu"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"
import { BeforeAfterSlider } from "@/components/shared/BeforeAfterSlider"

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
      <div className="relative rounded-2xl overflow-hidden shadow-sm">
        <BeforeAfterSlider
          beforeImage={beforeImage}
          afterImage={afterImage}
          height={height}
        />
        {/* Overlay with title */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 pt-12">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">{title}</h3>
              <p className="text-white/70 text-xs">{subtitle}</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

// Pro feature card component
function ProFeatureCard({
  href,
  beforeImage,
  afterImage,
  icon: Icon,
  title,
}: {
  href: string
  beforeImage: string
  afterImage: string
  icon: React.ElementType
  title: string
}) {
  return (
    <Link href={href} className="block">
      <div className="relative rounded-2xl overflow-hidden shadow-sm">
        <BeforeAfterSlider
          beforeImage={beforeImage}
          afterImage={afterImage}
          height={180}
        />
        {/* Overlay with title */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-8">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Icon className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-white text-sm">{title}</h3>
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
      <div className="bg-white px-6 pt-8 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Brand Camera" width={48} height={48} className="rounded-xl" />
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">{t.common.appName}</h1>
              <p className="text-sm text-zinc-500">{t.common.slogan}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </div>
        
        <p className="text-zinc-600 leading-relaxed text-sm">
          {t.home.description}
        </p>
      </div>
      
      {/* Main Feature Cards - 2 columns */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-2 gap-3">
          {/* 模特影棚 */}
          <FeatureCard
            href="/camera"
            beforeImage="/homepage/model-before.jpg"
            afterImage="/homepage/model-after.jpg"
            icon={Users}
            title={t.home.modelStudio}
            subtitle="AI真人穿拍"
            height={240}
          />
          
          {/* 商品影棚 */}
          <FeatureCard
            href="/studio"
            beforeImage="/homepage/product-before.jpg"
            afterImage="/homepage/product-after.jpg"
            icon={Lightbulb}
            title={t.home.productStudio}
            subtitle="静物场景合成"
            height={240}
          />
        </div>
      </div>
      
      {/* AI 修图室 Section */}
      <div className="px-4 mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 className="w-5 h-5 text-purple-500" />
          <h2 className="font-bold text-zinc-900">AI 修图室</h2>
          <span className="px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full font-medium">
            专业版功能
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {/* 换模特风格 */}
          <ProFeatureCard
            href="/edit"
            beforeImage="/homepage/style-before.jpg"
            afterImage="/homepage/style-after.jpg"
            icon={Users}
            title="换模特风格"
          />
          
          {/* 镜头控制 */}
          <ProFeatureCard
            href="/edit"
            beforeImage="/homepage/lens-before.jpg"
            afterImage="/homepage/lens-after.jpg"
            icon={Focus}
            title="镜头控制"
          />
          
          {/* Pose控制 */}
          <ProFeatureCard
            href="/edit"
            beforeImage="/homepage/pose-before.jpg"
            afterImage="/homepage/pose-after.jpg"
            icon={Move}
            title="Pose控制"
          />
          
          {/* 表情控制 */}
          <ProFeatureCard
            href="/edit"
            beforeImage="/homepage/expression-before.jpg"
            afterImage="/homepage/expression-after.jpg"
            icon={Smile}
            title="表情控制"
          />
        </div>
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
