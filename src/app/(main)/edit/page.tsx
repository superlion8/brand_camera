"use client"

import Image from "next/image"
import Link from "next/link"
import { Wand2, Lightbulb, Home, ChevronRight, Palette, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLanguageStore } from "@/stores/languageStore"
import { motion } from "framer-motion"

// Tool Card Component - 参考 Bcamui 设计
interface ToolCardProps {
  title: string
  description: string
  icon: React.ReactNode
  image: string
  color: string
  href: string
}

function ToolCard({ title, description, icon, image, color, href }: ToolCardProps) {
  return (
    <Link href={href}>
      <motion.div 
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.98 }}
        className="relative h-44 rounded-[20px] overflow-hidden cursor-pointer shadow-sm border border-zinc-100 group"
      >
        {/* Background Image with zoom effect */}
        <Image 
          src={image} 
          alt={title} 
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110" 
        />
        
        {/* Color overlay */}
        <div className={`absolute inset-0 opacity-70 mix-blend-multiply ${color}`} />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 p-4 flex flex-col justify-between z-10">
          {/* Icon */}
          <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg">
            {icon}
          </div>
          
          {/* Text */}
          <div>
            <h3 className="text-xl font-bold text-white mb-1 drop-shadow-md">{title}</h3>
            <p className="text-sm text-white/85 font-medium leading-snug drop-shadow-sm">{description}</p>
          </div>
        </div>

        {/* Arrow Icon (visible on hover) */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
          <div className="w-9 h-9 rounded-full bg-white text-zinc-800 flex items-center justify-center shadow-lg">
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}


export default function EditHubPage() {
  const router = useRouter()
  const t = useLanguageStore(state => state.t)
  
  // Feature cards with translations
  const FEATURE_CARDS = [
    {
      id: 'general',
      title: t.edit.generalEdit,
      description: t.edit.generalEditDesc,
      icon: <Wand2 className="w-5 h-5" />,
      href: '/edit/general',
      color: 'bg-violet-600',
      image: 'https://images.unsplash.com/photo-1607616996527-a641c438bc69?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    },
    {
      id: 'studio',
      title: t.edit.productStudioCard,
      description: t.edit.productStudioCardDesc,
      icon: <Lightbulb className="w-5 h-5" />,
      href: '/studio',
      color: 'bg-amber-600',
      image: 'https://images.unsplash.com/photo-1693763824929-bd6b4b959e2b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    },
    {
      id: 'modify-material',
      title: t.edit.modifyMaterial || '改材质版型',
      description: t.edit.modifyMaterialDesc || '修改生成图的服装材质和版型',
      icon: <Palette className="w-5 h-5" />,
      href: '/gallery/modify-material',
      color: 'bg-purple-600',
      image: 'https://images.unsplash.com/photo-1558171813-4c088753af8f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    },
    {
      id: 'try-on',
      title: t.tryOn?.title || '虚拟换装',
      description: t.tryOn?.subtitle || 'AI 智能换装体验',
      icon: <Sparkles className="w-5 h-5" />,
      href: '/try-on',
      color: 'bg-pink-600',
      image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    },
  ]

  
  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header */}
      <div className="h-14 border-b bg-white/95 backdrop-blur-md flex items-center px-4 shrink-0 sticky top-0 z-30">
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
        <div className="px-4 pt-6 pb-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-2xl font-bold text-zinc-900">{t.edit.title}</h1>
            <p className="text-sm text-zinc-500 mt-1.5">{t.edit.subtitle || '选择工具开始创作'}</p>
          </motion.div>
        </div>
        
        {/* Feature Cards */}
        <div className="px-4 space-y-4">
          {FEATURE_CARDS.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <ToolCard
                title={card.title}
                description={card.description}
                icon={card.icon}
                image={card.image}
                color={card.color}
                href={card.href}
              />
            </motion.div>
          ))}
        </div>
        
      </div>
    </div>
  )
}
