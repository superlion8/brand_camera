"use client"

import Image from "next/image"
import Link from "next/link"
import { ChevronRight, FolderHeart, Images, Wand2, Users, Lightbulb, Sparkles, Grid3X3, ScanFace, Box, Settings, Palette } from "lucide-react"
import { motion } from "framer-motion"
import { useAssetStore } from "@/stores/assetStore"
import { useTranslation } from "@/stores/languageStore"
import { UserMenu } from "@/components/shared/UserMenu"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"
import { QuotaIndicator } from "@/components/shared/QuotaIndicator"
import { SyncIndicator } from "@/components/shared/SyncIndicator"

// Supabase Storage base URL for homepage images
const HOMEPAGE_STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/homepage'

// Section Header Component
function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-3 mt-6 first:mt-2">
      {icon && <div className="text-zinc-900">{icon}</div>}
      <h2 className="text-base font-bold text-zinc-900 tracking-tight">{title}</h2>
    </div>
  )
}

// Before-After Card with animated reveal
function BeforeAfterCard({
  title,
  subtitle,
  beforeImage,
  afterImage,
  badge,
  href,
}: {
  title: string
  subtitle: string
  beforeImage: string
  afterImage: string
  badge?: string
  href: string
}) {
  return (
    <Link href={href}>
      <motion.div
        whileTap={{ scale: 0.95 }}
        className="min-w-[160px] w-[160px] h-[220px] rounded-[16px] overflow-hidden relative bg-zinc-100 shadow-sm border border-zinc-100 snap-start cursor-pointer group"
      >
        {/* Before Image (Base) */}
        <div className="absolute inset-0">
          <Image src={beforeImage} alt="Before" fill className="object-cover" />
          <div className="absolute top-2 left-2 w-[52px] text-center py-0.5 bg-black/40 backdrop-blur-sm rounded text-[9px] font-bold text-white/80 z-10">
            Original
          </div>
        </div>

        {/* After Image (Animated Overlay) */}
        <motion.div
          className="absolute inset-y-0 left-0 overflow-hidden border-r border-white/50"
          animate={{ width: ["0%", "100%", "100%"] }}
          transition={{
            duration: 6,
            ease: "easeInOut",
            times: [0, 0.8, 1],
            repeat: Infinity,
            repeatDelay: 2,
          }}
        >
          <div className="absolute inset-0 w-[160px] h-full">
            <Image src={afterImage} alt="After" fill className="object-cover" />
          </div>
          <div className="absolute top-2 left-2 w-[52px] text-center py-0.5 bg-purple-600/80 backdrop-blur-sm rounded text-[9px] font-bold text-white z-10">
            Result
          </div>
        </motion.div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

        {badge && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-white/20 backdrop-blur-md rounded text-[9px] font-bold text-white border border-white/20 z-20">
            {badge}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
          <h3 className="text-sm font-bold text-white leading-tight mb-0.5">{title}</h3>
          <p className="text-[10px] text-white/70 font-medium">{subtitle}</p>
        </div>
      </motion.div>
    </Link>
  )
}

// Retouch Row Item
function RetouchRow({
  title,
  subtitle,
  icon,
  image,
  href,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  image: string
  href: string
}) {
  return (
    <Link href={href}>
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-4 p-3 bg-white rounded-2xl border border-zinc-100 shadow-sm mb-2.5 cursor-pointer"
      >
        <div className="w-14 h-14 rounded-xl overflow-hidden bg-zinc-100 shrink-0 relative">
          <Image src={image} alt={title} fill className="object-cover" />
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute inset-0 flex items-center justify-center text-white drop-shadow-md">
            {icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-zinc-900 truncate">{title}</h3>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{subtitle}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center shrink-0">
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        </div>
      </motion.div>
    </Link>
  )
}

// 页面进入动效配置
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
      staggerChildren: 0.1,
    }
  },
}

const sectionVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" }
  },
}

export default function HomePage() {
  const { generations, _hasHydrated } = useAssetStore()
  const { t } = useTranslation()

  // Get recent generations (last 4)
  const recentGenerations = generations.slice(0, 4)

  return (
    <motion.div 
      className="min-h-full bg-zinc-50/50 pb-32"
      initial="initial"
      animate="animate"
      variants={pageVariants}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white/90 backdrop-blur-md sticky top-0 z-30 border-b border-zinc-100/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
            <Image src="/logo.png" alt="Brand Camera" width={20} height={20} className="rounded" />
          </div>
          <span className="text-base font-bold text-zinc-900 tracking-tight">{t.common.appName}</span>
          <span className="px-1.5 py-0.5 bg-amber-50 rounded-full border border-amber-100 text-[10px] font-bold text-amber-700">
            {t.beta.tag}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SyncIndicator />
          <QuotaIndicator />
          <LanguageSwitcher />
          <UserMenu />
        </div>
      </div>

      {/* Content */}
      <div className="pt-2 pb-24">
        {/* Section 1: 拍模特 */}
        <motion.div className="px-4" variants={sectionVariants}>
          <SectionHeader
            title={t.home.shootModel || "拍模特"}
            icon={<ScanFace className="w-4 h-4 text-purple-600" />}
          />
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x">
            <BeforeAfterCard
              title={t.home.proStudio || "专业棚拍"}
              subtitle={t.home.proStudioSubtitle || "纯色背景质感"}
              beforeImage={`${HOMEPAGE_STORAGE_URL}/pro-studio-before.jpg`}
              afterImage={`${HOMEPAGE_STORAGE_URL}/pro-studio-after.png`}
              href="/pro-studio"
            />
            <BeforeAfterCard
              title={t.home.modelStudio || "买家秀"}
              subtitle={t.home.modelStudioSubtitle || "真实生活场景"}
              beforeImage={`${HOMEPAGE_STORAGE_URL}/model-before.jpg`}
              afterImage={`${HOMEPAGE_STORAGE_URL}/model-after.png`}
              href="/camera"
            />
            <BeforeAfterCard
              title={t.home.groupShoot || "组图拍摄"}
              subtitle={t.home.groupShootSubtitle || "多角度套图"}
              beforeImage={`${HOMEPAGE_STORAGE_URL}/group-shoot-before.png`}
              afterImage={`${HOMEPAGE_STORAGE_URL}/group-shoot-after.png`}
              badge="NEW"
              href="/camera/group"
            />
          </div>
        </motion.div>

        {/* Section 2: 拍商品 */}
        <motion.div className="px-4 mt-2" variants={sectionVariants}>
          <SectionHeader
            title={t.home.shootProduct || "拍商品"}
            icon={<Box className="w-4 h-4 text-orange-600" />}
          />
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x">
            <BeforeAfterCard
              title={t.home.productStudio || "商品棚拍"}
              subtitle={t.home.productStudioSubtitle || "电商白底图"}
              beforeImage={`${HOMEPAGE_STORAGE_URL}/product-before.jpg`}
              afterImage={`${HOMEPAGE_STORAGE_URL}/product-after.jpg`}
              href="/studio"
            />
          </div>
        </motion.div>

        {/* Section 3: 修图室 */}
        <motion.div className="px-4 mt-2" variants={sectionVariants}>
          <SectionHeader
            title={t.home.retouchRoom || "修图室"}
            icon={<Wand2 className="w-4 h-4 text-blue-600" />}
          />
          <div className="flex flex-col">
            <RetouchRow
              title={t.home.generalEdit || "通用编辑"}
              subtitle={t.home.generalEditDesc || "画质增强、智能抠图、消除笔"}
              icon={<Settings className="w-6 h-6" />}
              image="https://images.unsplash.com/photo-1746458825397-9cd95fff0dfb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200"
              href="/edit/general"
            />
            <RetouchRow
              title={t.home.modifyMaterial || "改材质版型"}
              subtitle={t.home.modifyMaterialDesc || "先在成片中选择一张图，再点击修改"}
              icon={<Palette className="w-6 h-6" />}
              image="https://images.unsplash.com/photo-1558171813-4c088753af8f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200"
              href="/gallery"
            />
          </div>
        </motion.div>

        {/* Section 4: Quick Links */}
        <motion.div className="px-4 mt-4" variants={sectionVariants}>
          <div className="space-y-2">
            <div>
              <Link
                href="/brand-assets"
                className="flex items-center justify-between bg-white rounded-xl p-3 border border-zinc-100 active:bg-zinc-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-zinc-100 rounded-lg flex items-center justify-center">
                    <FolderHeart className="w-4 h-4 text-zinc-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-900 text-sm">{t.assets.title}</h3>
                    <p className="text-[11px] text-zinc-500">
                      {t.common.model}、{t.common.background}、{t.common.product}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </Link>
            </div>

            <div>
              <Link
                href="/gallery"
                className="flex items-center justify-between bg-white rounded-xl p-3 border border-zinc-100 active:bg-zinc-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-zinc-100 rounded-lg flex items-center justify-center">
                    <Images className="w-4 h-4 text-zinc-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-zinc-900 text-sm">{t.nav.gallery}</h3>
                    <p className="text-[11px] text-zinc-500">{t.gallery.favorites}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </Link>
            </div>
          </div>
        </motion.div>

        {/* My Gallery */}
        {_hasHydrated && recentGenerations.length > 0 && (
          <motion.div className="px-4 mt-6" variants={sectionVariants}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-500 uppercase">{t.home.myGallery}</h2>
              <Link href="/gallery" className="text-xs text-blue-600 font-medium">
                {t.home.viewAll}
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {recentGenerations.map((gen) => {
                const imageUrl = gen.outputImageUrls?.[0]
                if (!imageUrl) return null
                return (
                  <Link
                    key={gen.id}
                    href="/gallery"
                    className="aspect-square rounded-lg overflow-hidden bg-zinc-200"
                  >
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
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
