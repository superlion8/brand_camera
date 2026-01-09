"use client"

import Image from "next/image"
import Link from "next/link"
import { ChevronRight, FolderHeart, Images, Wand2, Users, Lightbulb, Sparkles, Grid3X3, ScanFace, Box, Settings, Palette, UserRoundPlus } from "lucide-react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useAssetStore } from "@/stores/assetStore"
import { useModelCreateStore } from "@/stores/modelCreateStore"
import { useTranslation } from "@/stores/languageStore"
import { UserMenu } from "@/components/shared/UserMenu"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"
import { QuotaIndicator } from "@/components/shared/QuotaIndicator"
import { SyncIndicator } from "@/components/shared/SyncIndicator"
import { useIsDesktop } from "@/hooks/useIsMobile"
import { ScreenLoadingGuard } from "@/components/ui/ScreenLoadingGuard"

// Supabase Storage base URL for homepage images
const HOMEPAGE_STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/homepage'
// Features showcase images (new)
const FEATURES_URL = `${HOMEPAGE_STORAGE_URL}/features`

// Section Header Component
function SectionHeader({ title, icon, className }: { title: string; icon: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 px-1 mb-3 mt-6 first:mt-2 ${className || ''}`}>
      {icon && <div className="text-zinc-900">{icon}</div>}
      <h2 className="text-base font-bold text-zinc-900 tracking-tight lg:text-lg">{title}</h2>
    </div>
  )
}

// Showcase Card - 单张效果图展示
function ShowcaseCard({
  title,
  subtitle,
  image,
  badge,
  href,
  isDesktop = false,
}: {
  title: string
  subtitle: string
  image: string
  badge?: string
  href: string
  isDesktop?: boolean
}) {
  const cardClass = isDesktop 
    ? "w-full aspect-[16/9] rounded-2xl"
    : "min-w-[160px] w-[160px] h-[220px] rounded-[16px] snap-start"

  return (
    <Link href={href}>
      <motion.div
        whileHover={isDesktop ? { scale: 1.02, y: -4 } : undefined}
        whileTap={{ scale: 0.95 }}
        className={`${cardClass} overflow-hidden relative bg-zinc-100 shadow-sm border border-zinc-100 cursor-pointer group`}
      >
        {/* Main Image */}
        <div className="absolute inset-0">
          <Image src={image} alt={title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

        {badge && (
          <div className="absolute top-2 right-2 lg:top-3 lg:right-3 px-1.5 lg:px-2 py-0.5 lg:py-1 bg-white/20 backdrop-blur-md rounded text-[9px] lg:text-[10px] font-bold text-white border border-white/20 z-20">
            {badge}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3 lg:p-4 z-20">
          <h3 className="text-sm lg:text-base font-bold text-white leading-tight mb-0.5">{title}</h3>
          <p className="text-[10px] lg:text-xs text-white/70 font-medium">{subtitle}</p>
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
        whileHover={{ scale: 1.01 }}
        className="flex items-center gap-4 p-3 lg:p-4 bg-white rounded-2xl border border-zinc-100 shadow-sm mb-2.5 cursor-pointer"
      >
        <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-xl overflow-hidden bg-zinc-100 shrink-0 relative">
          <Image src={image} alt={title} fill className="object-cover" />
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute inset-0 flex items-center justify-center text-white drop-shadow-md">
            {icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm lg:text-base font-bold text-zinc-900 truncate">{title}</h3>
          <p className="text-xs lg:text-sm text-zinc-500 mt-0.5 truncate">{subtitle}</p>
        </div>
        <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-zinc-50 flex items-center justify-center shrink-0">
          <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-zinc-400" />
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
  const router = useRouter()
  const { generations, _hasHydrated } = useAssetStore()
  const { reset: resetModelCreate } = useModelCreateStore()
  const { t } = useTranslation()
  const { isDesktop, isMobile, isLoading } = useIsDesktop(1024)

  // Get recent generations (last 4 for mobile, last 8 for desktop)
  const recentGenerations = generations.slice(0, isMobile ? 4 : 8)

  // 点击创建专属模特时，重置状态并导航
  const handleCreateModelClick = () => {
    resetModelCreate()
    router.push('/model-create')
  }

  // 防止 hydration 闪烁
  if (isLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }

  return (
    <motion.div 
      className="min-h-full bg-zinc-50/50 pb-32 lg:pb-8"
      initial="initial"
      animate="animate"
      variants={pageVariants}
    >
      {/* Mobile Header - Hidden on Desktop (handled by TopNav) */}
      <div className="lg:hidden flex items-center justify-between px-5 py-3 bg-white/90 backdrop-blur-md sticky top-0 z-30 border-b border-zinc-100/50">
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
      <div className="pt-2 pb-24 lg:pt-6 lg:pb-8 lg:px-6">
        {/* Desktop Welcome Section */}
        {isDesktop && (
          <motion.div className="mb-8" variants={sectionVariants}>
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">{t.home?.welcome || '欢迎使用 Brand Camera'}</h1>
            <p className="text-zinc-500">{t.home?.welcomeDesc || '选择下方功能开始创作'}</p>
          </motion.div>
        )}

        {/* Section 1: 拍模特 */}
        <motion.div className="px-4 lg:px-0" variants={sectionVariants}>
          <SectionHeader
            title={t.home.shootModel || "拍模特"}
            icon={<ScanFace className="w-4 h-4 text-purple-600" />}
          />
          {/* Mobile: Horizontal Scroll */}
          <div className="lg:hidden flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x">
            <ShowcaseCard
              title={t.home.proStudio || "专业棚拍"}
              subtitle={t.home.proStudioSubtitle || "纯色背景质感"}
              image={`${FEATURES_URL}/pro-studio.jpg`}
              href="/pro-studio"
            />
            <ShowcaseCard
              title={t.home.lifestyleMode || "LifeStyle 街拍"}
              subtitle={t.home.lifestyleModeSubtitle || "AI 智能匹配模特与街景"}
              image={`${FEATURES_URL}/lifestyle.jpg`}
              badge="NEW"
              href="/lifestyle"
            />
            <ShowcaseCard
              title={t.home.modelStudio || "买家秀"}
              subtitle={t.home.modelStudioSubtitle || "真实生活场景"}
              image={`${FEATURES_URL}/buyer-show.jpg`}
              href="/camera"
            />
            <ShowcaseCard
              title={t.home.socialMode || "社媒种草"}
              subtitle={t.home.socialModeSubtitle || "小红书INS风格"}
              image={`${FEATURES_URL}/social.jpg`}
              badge="NEW"
              href="/camera/social"
            />
          </div>
          {/* Desktop: Grid Layout */}
          <div className="hidden lg:grid lg:grid-cols-4 gap-4 pb-4">
            <ShowcaseCard
              title={t.home.proStudio || "专业棚拍"}
              subtitle={t.home.proStudioSubtitle || "纯色背景质感"}
              image={`${FEATURES_URL}/pro-studio.jpg`}
              href="/pro-studio"
              isDesktop
            />
            <ShowcaseCard
              title={t.home.lifestyleMode || "LifeStyle 街拍"}
              subtitle={t.home.lifestyleModeSubtitle || "AI 智能匹配模特与街景"}
              image={`${FEATURES_URL}/lifestyle.jpg`}
              badge="NEW"
              href="/lifestyle"
              isDesktop
            />
            <ShowcaseCard
              title={t.home.modelStudio || "买家秀"}
              subtitle={t.home.modelStudioSubtitle || "真实生活场景"}
              image={`${FEATURES_URL}/buyer-show.jpg`}
              href="/camera"
              isDesktop
            />
            <ShowcaseCard
              title={t.home.socialMode || "社媒种草"}
              subtitle={t.home.socialModeSubtitle || "小红书INS风格"}
              image={`${FEATURES_URL}/social.jpg`}
              badge="NEW"
              href="/camera/social"
              isDesktop
            />
          </div>
        </motion.div>

        {/* Section 2: 定制拍摄 Custom Shot */}
        <motion.div className="px-4 lg:px-0 mt-2" variants={sectionVariants}>
          <SectionHeader
            title={t.home.customShot || "定制拍摄"}
            icon={<Sparkles className="w-4 h-4 text-pink-600" />}
          />
          {/* Mobile: Horizontal Scroll */}
          <div className="lg:hidden flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x">
            <ShowcaseCard
              title={t.home.groupShoot || "组图拍摄"}
              subtitle={t.home.groupShootSubtitle || "多角度套图"}
              image={`${FEATURES_URL}/group.jpg`}
              href="/camera/group"
            />
            <ShowcaseCard
              title={t.home.referenceShot || "参考图拍摄"}
              subtitle={t.home.referenceShotSubtitle || "复刻风格"}
              image={`${FEATURES_URL}/reference.jpg`}
              badge="NEW"
              href="/reference-shot"
            />
            <ShowcaseCard
              title={t.home.productStudio || "商品棚拍"}
              subtitle={t.home.productStudioSubtitle || "电商白底图"}
              image={`${FEATURES_URL}/product-studio.jpg`}
              href="/studio"
            />
            <ShowcaseCard
              title={t.home.tryOn || "虚拟换装"}
              subtitle={t.home.tryOnSubtitle || "AI 智能换装"}
              image={`${FEATURES_URL}/try-on.jpg`}
              badge="NEW"
              href="/try-on"
            />
          </div>
          {/* Desktop: Grid Layout */}
          <div className="hidden lg:grid lg:grid-cols-4 gap-4 pb-4">
            <ShowcaseCard
              title={t.home.groupShoot || "组图拍摄"}
              subtitle={t.home.groupShootSubtitle || "多角度套图"}
              image={`${FEATURES_URL}/group.jpg`}
              href="/camera/group"
              isDesktop
            />
            <ShowcaseCard
              title={t.home.referenceShot || "参考图拍摄"}
              subtitle={t.home.referenceShotSubtitle || "复刻风格"}
              image={`${FEATURES_URL}/reference.jpg`}
              badge="NEW"
              href="/reference-shot"
              isDesktop
            />
            <ShowcaseCard
              title={t.home.productStudio || "商品棚拍"}
              subtitle={t.home.productStudioSubtitle || "电商白底图"}
              image={`${FEATURES_URL}/product-studio.jpg`}
              href="/studio"
              isDesktop
            />
            <ShowcaseCard
              title={t.home.tryOn || "虚拟换装"}
              subtitle={t.home.tryOnSubtitle || "AI 智能换装"}
              image={`${FEATURES_URL}/try-on.jpg`}
              badge="NEW"
              href="/try-on"
              isDesktop
            />
          </div>
        </motion.div>

        {/* Create Custom Model & Brand Style - PC: 16:9 grid cards */}
        <motion.div className="px-4 lg:px-0 mt-4" variants={sectionVariants}>
          {/* Mobile: stacked layout */}
          <div className="flex flex-col gap-3 lg:hidden">
            {/* Create Custom Model Card - Mobile */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              onClick={handleCreateModelClick}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 p-4 cursor-pointer"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shrink-0">
                  <UserRoundPlus className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{t.home.createCustomModel}</h3>
                    <span className="px-1.5 py-0.5 bg-white/20 backdrop-blur-sm rounded text-[10px] font-bold text-white">NEW</span>
                  </div>
                  <p className="text-sm text-white/80 mt-0.5">{t.home.createCustomModelDesc}</p>
                </div>
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shrink-0">
                  <ChevronRight className="w-5 h-5 text-white" />
                </div>
              </div>
            </motion.div>

            {/* Brand Style Card - Mobile */}
            <Link href="/brand-style">
              <motion.div
                whileTap={{ scale: 0.98 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-4 cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shrink-0">
                    <Palette className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{t.home.brandStyle}</h3>
                      <span className="px-1.5 py-0.5 bg-white/20 backdrop-blur-sm rounded text-[10px] font-bold text-white">NEW</span>
                    </div>
                    <p className="text-sm text-white/80 mt-0.5">{t.home.brandStyleSubtitle}</p>
                  </div>
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shrink-0">
                    <ChevronRight className="w-5 h-5 text-white" />
                  </div>
                </div>
              </motion.div>
            </Link>
          </div>

          {/* Desktop: 16:9 grid cards - same size as other cards */}
          <div className="hidden lg:grid lg:grid-cols-4 lg:gap-4">
            {/* Create Custom Model Card - Desktop */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              onClick={handleCreateModelClick}
              className="relative overflow-hidden rounded-2xl cursor-pointer aspect-[16/9]"
            >
              {/* Background image - 使用 create-model 展示图 */}
              <Image
                src={`${FEATURES_URL}/create-model.jpg`}
                alt="Create Custom Model"
                fill
                className="object-cover"
                unoptimized
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-violet-600/90 via-purple-500/60 to-transparent" />
              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-end p-3">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 bg-purple-500 rounded text-[10px] font-bold text-white">NEW</span>
                </div>
                <h3 className="text-sm font-bold text-white mt-1">{t.home.createCustomModel}</h3>
                <p className="text-xs text-white/80">{t.home.createCustomModelDesc}</p>
              </div>
            </motion.div>

            {/* Brand Style Card - Desktop */}
            <Link href="/brand-style">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="relative overflow-hidden rounded-2xl cursor-pointer aspect-[16/9]"
              >
                {/* Background image - 使用 lifestyle 展示图 */}
                <Image
                  src={`${FEATURES_URL}/lifestyle.jpg`}
                  alt="Clone Brand Style"
                  fill
                  className="object-cover"
                  unoptimized
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-orange-600/90 via-amber-500/60 to-transparent" />
                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-orange-500 rounded text-[10px] font-bold text-white">NEW</span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1">{t.home.brandStyle}</h3>
                  <p className="text-xs text-white/80">{t.home.brandStyleSubtitle}</p>
                </div>
              </motion.div>
            </Link>
          </div>
        </motion.div>

        {/* Section 3: 修图室 - Desktop: Side by side with Quick Links */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 mt-2">
          <motion.div className="px-4 lg:px-0" variants={sectionVariants}>
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
              subtitle={t.home.modifyMaterialDesc || "修改生成图的服装材质和版型"}
              icon={<Palette className="w-6 h-6" />}
              image="https://images.unsplash.com/photo-1558171813-4c088753af8f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200"
              href="/gallery/modify-material"
            />
          </div>
        </motion.div>

        {/* Section 4: Quick Links */}
          <motion.div className="px-4 lg:px-0 mt-4 lg:mt-0" variants={sectionVariants}>
            <SectionHeader
              title={t.home?.quickLinks || "快捷入口"}
              icon={<Grid3X3 className="w-4 h-4 text-zinc-600" />}
              className="lg:block hidden"
            />
            <div className="space-y-2 lg:mt-9">
            <div>
              <Link
                href="/brand-assets"
                  className="flex items-center justify-between bg-white rounded-xl p-3 lg:p-4 border border-zinc-100 active:bg-zinc-50 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 lg:w-10 lg:h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
                      <FolderHeart className="w-4 h-4 lg:w-5 lg:h-5 text-zinc-600" />
                  </div>
                  <div>
                      <h3 className="font-medium text-zinc-900 text-sm lg:text-base">{t.assets.title}</h3>
                      <p className="text-[11px] lg:text-xs text-zinc-500">
                      {t.common.model}、{t.common.background}、{t.common.product}
                    </p>
                  </div>
                </div>
                  <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-zinc-400" />
              </Link>
            </div>

            <div>
              <Link
                href="/gallery"
                  className="flex items-center justify-between bg-white rounded-xl p-3 lg:p-4 border border-zinc-100 active:bg-zinc-50 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 lg:w-10 lg:h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
                      <Images className="w-4 h-4 lg:w-5 lg:h-5 text-zinc-600" />
                  </div>
                  <div>
                      <h3 className="font-medium text-zinc-900 text-sm lg:text-base">{t.nav.gallery}</h3>
                      <p className="text-[11px] lg:text-xs text-zinc-500">{t.gallery.favorites}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 text-zinc-400" />
              </Link>
            </div>
          </div>
        </motion.div>
        </div>

        {/* My Gallery */}
        {_hasHydrated && recentGenerations.length > 0 && (
          <motion.div className="px-4 lg:px-0 mt-6" variants={sectionVariants}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm lg:text-base font-semibold text-zinc-500 uppercase">{t.home.myGallery}</h2>
              <Link href="/gallery" className="text-xs lg:text-sm text-blue-600 font-medium hover:text-blue-700">
                {t.home.viewAll}
              </Link>
            </div>
            <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 lg:gap-3">
              {recentGenerations.map((gen) => {
                const imageUrl = gen.outputImageUrls?.[0]
                if (!imageUrl) return null
                return (
                  <Link
                    key={gen.id}
                    href="/gallery"
                    className="aspect-square rounded-lg lg:rounded-xl overflow-hidden bg-zinc-200 hover:opacity-90 transition-opacity"
                  >
                    <Image
                      src={imageUrl}
                      alt="Generated"
                      width={150}
                      height={150}
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
