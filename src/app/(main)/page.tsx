"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, FolderHeart, Images, Wand2, Users, Lightbulb, Sparkles, Grid3X3 } from "lucide-react"
import { motion } from "framer-motion"
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
  accent,
}: {
  href: string
  beforeImage: string
  afterImage: string
  icon: React.ElementType
  title: string
  subtitle: string
  height?: number
  accent?: 'purple' | 'amber' | 'blue'
}) {
  const accentStyles = accent === 'purple' 
    ? { bg: 'bg-purple-500', iconBg: 'bg-purple-100', iconColor: 'text-purple-600', textColor: 'text-white', subColor: 'text-purple-100' }
    : accent === 'amber'
    ? { bg: 'bg-amber-500', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', textColor: 'text-white', subColor: 'text-amber-100' }
    : accent === 'blue'
    ? { bg: 'bg-gradient-to-r from-blue-500 to-cyan-500', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', textColor: 'text-white', subColor: 'text-blue-100' }
    : { bg: 'bg-white', iconBg: 'bg-zinc-100', iconColor: 'text-zinc-600', textColor: 'text-zinc-900', subColor: 'text-zinc-500' }
  
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
        <div className={`p-2.5 ${accentStyles.bg}`}>
          <div className="flex items-center gap-1.5">
            <div className={`w-6 h-6 ${accent ? 'bg-white/20' : accentStyles.iconBg} rounded-full flex items-center justify-center shrink-0`}>
              <Icon className={`w-3 h-3 ${accent ? 'text-white' : accentStyles.iconColor}`} />
            </div>
            <div className="min-w-0">
              <h3 className={`font-bold text-sm truncate ${accentStyles.textColor}`}>{title}</h3>
              <p className={`text-[10px] truncate ${accentStyles.subColor}`}>{subtitle}</p>
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
      
      {/* Main Feature Cards - 2 columns for first row, 1 for second */}
      <div className="px-4 mt-4 space-y-3">
        {/* First Row: 买家秀 + 专业棚拍 */}
        <div className="grid grid-cols-2 gap-3">
          {/* 买家秀 (原模特影棚) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <FeatureCard
              href="/camera"
              beforeImage={`${HOMEPAGE_STORAGE_URL}/model-before.jpg`}
              afterImage={`${HOMEPAGE_STORAGE_URL}/model-after.png`}
              icon={Users}
              title={t.home.modelStudio}
              subtitle={t.home.modelStudioSubtitle}
              height={180}
              accent="purple"
            />
          </motion.div>
          
          {/* 专业棚拍 (新功能) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <FeatureCard
              href="/pro-studio"
              beforeImage={`${HOMEPAGE_STORAGE_URL}/model-before.jpg`}
              afterImage={`${HOMEPAGE_STORAGE_URL}/model-after.png`}
              icon={Sparkles}
              title={t.home.proStudio}
              subtitle={t.home.proStudioSubtitle}
              height={180}
              accent="amber"
            />
          </motion.div>
        </div>
        
        {/* 组图拍摄 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <FeatureCard
            href="/camera/group"
            beforeImage={`${HOMEPAGE_STORAGE_URL}/model-before.jpg`}
            afterImage={`${HOMEPAGE_STORAGE_URL}/model-after.png`}
            icon={Grid3X3}
            title={t.home.groupShoot || '组图拍摄'}
            subtitle={t.home.groupShootSubtitle || '一键生成多角度/多姿势展示图'}
            height={120}
            accent="blue"
          />
        </motion.div>
        
        {/* Second Row: 商品影棚 full width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <FeatureCard
            href="/studio"
            beforeImage={`${HOMEPAGE_STORAGE_URL}/product-before.jpg`}
            afterImage={`${HOMEPAGE_STORAGE_URL}/product-after.jpg`}
            icon={Lightbulb}
            title={t.home.productStudio}
            subtitle={t.home.productStudioSubtitle}
            height={140}
          />
        </motion.div>
      </div>
      
      {/* Navigation Cards */}
      <div className="px-4 mt-4">
        <div className="space-y-2">
          {/* Edit Room - 弱化样式 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Link href="/edit/general" className="flex items-center justify-between bg-white rounded-xl p-3 border border-zinc-100 active:bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Wand2 className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-zinc-900 text-sm">{t.home.editRoom}</h3>
                  <p className="text-[11px] text-zinc-500">{t.home.editRoomDesc}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
            </Link>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <Link href="/brand-assets" className="flex items-center justify-between bg-white rounded-xl p-3 border border-zinc-100 active:bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-zinc-100 rounded-lg flex items-center justify-center">
                  <FolderHeart className="w-4 h-4 text-zinc-600" />
                </div>
                <div>
                  <h3 className="font-medium text-zinc-900 text-sm">{t.assets.title}</h3>
                  <p className="text-[11px] text-zinc-500">{t.common.model}、{t.common.background}、{t.common.product}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
            </Link>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <Link href="/gallery" className="flex items-center justify-between bg-white rounded-xl p-3 border border-zinc-100 active:bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-zinc-100 rounded-lg flex items-center justify-center">
                  <Images className="w-4 h-4 text-zinc-600" />
                </div>
                <div>
                  <h3 className="font-medium text-zinc-900 text-sm">{t.nav.gallery}</h3>
                  <p className="text-[11px] text-zinc-500">{t.gallery.favorites}</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400" />
            </Link>
          </motion.div>
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
