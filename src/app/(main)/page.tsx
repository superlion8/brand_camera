"use client"

import Image from "next/image"
import Link from "next/link"
import { Camera, Wand2, FolderHeart, Images, ArrowRight, Lightbulb, Users, Sparkles } from "lucide-react"
import { useAssetStore } from "@/stores/assetStore"
import { UserMenu } from "@/components/shared/UserMenu"

export default function HomePage() {
  const { generations, _hasHydrated } = useAssetStore()
  
  // Get recent generations (last 4)
  const recentGenerations = generations.slice(0, 4)
  
  return (
    <div className="min-h-full bg-zinc-50 pb-32">
      {/* Hero Section */}
      <div className="bg-white px-6 pt-8 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Brand Camera" width={48} height={48} className="rounded-xl" />
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">品牌相机</h1>
              <p className="text-sm text-zinc-500">品牌的AI影棚</p>
            </div>
          </div>
          <UserMenu />
        </div>
        
        <p className="text-zinc-600 leading-relaxed text-sm">
          一键生成专业的商品图和模特展示图，搭配灵活更换模特、背景、风格的后编辑能力，让你的产品在社交媒体上脱颖而出。
        </p>
      </div>
      
      {/* Feature Cards - Two column layout */}
      <div className="px-4 -mt-4 space-y-3">
        {/* 模特影棚 */}
        <Link href="/camera" className="block">
          <div className="flex gap-2">
            {/* Feature Card */}
            <div className="w-28 shrink-0 bg-zinc-900 text-white rounded-2xl p-4 flex flex-col justify-center">
              <Users className="w-6 h-6 text-blue-400 mb-2" />
              <h3 className="font-bold text-sm">模特影棚</h3>
            </div>
            {/* Effect Preview */}
            <div className="flex-1 bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center justify-center gap-2">
              <div className="w-16 h-20 rounded-lg overflow-hidden bg-white shadow-sm">
                <Image 
                  src="/homepage/before.jpg" 
                  alt="Before" 
                  width={64} 
                  height={80} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-16 h-20 rounded-lg overflow-hidden bg-white shadow-sm">
                <Image 
                  src="/homepage/after1.png" 
                  alt="After1" 
                  width={64} 
                  height={80} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-16 h-20 rounded-lg overflow-hidden bg-white shadow-sm">
                <Image 
                  src="/homepage/after2.png" 
                  alt="After2" 
                  width={64} 
                  height={80} 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </Link>
        
        {/* 商品影棚 */}
        <Link href="/studio" className="block">
          <div className="flex gap-2">
            {/* Feature Card */}
            <div className="w-28 shrink-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-4 flex flex-col justify-center">
              <Lightbulb className="w-6 h-6 text-amber-100 mb-2" />
              <h3 className="font-bold text-sm">商品影棚</h3>
            </div>
            {/* Effect Preview */}
            <div className="flex-1 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-center gap-2">
              <div className="w-16 h-20 rounded-lg overflow-hidden bg-white shadow-sm flex items-center justify-center">
                <span className="text-xs text-amber-400">Before</span>
              </div>
              <div className="w-16 h-20 rounded-lg overflow-hidden bg-white shadow-sm flex items-center justify-center">
                <span className="text-xs text-amber-400">After1</span>
              </div>
              <div className="w-16 h-20 rounded-lg overflow-hidden bg-white shadow-sm flex items-center justify-center">
                <span className="text-xs text-amber-400">After2</span>
              </div>
            </div>
          </div>
        </Link>
        
        {/* 修图室 */}
        <Link href="/edit" className="block">
          <div className="flex gap-2">
            {/* Feature Card */}
            <div className="w-28 shrink-0 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-2xl p-4 flex flex-col justify-center">
              <Wand2 className="w-6 h-6 text-purple-200 mb-2" />
              <h3 className="font-bold text-sm">修图室</h3>
            </div>
            {/* Effect Preview */}
            <div className="flex-1 bg-purple-50 border border-purple-200 rounded-2xl p-3 flex items-center justify-center gap-2">
              <div className="w-16 h-20 rounded-lg overflow-hidden bg-white shadow-sm flex items-center justify-center">
                <span className="text-xs text-purple-400">Before</span>
              </div>
              <div className="w-16 h-20 rounded-lg overflow-hidden bg-white shadow-sm flex items-center justify-center">
                <span className="text-xs text-purple-400">After1</span>
              </div>
              <div className="w-16 h-20 rounded-lg overflow-hidden bg-white shadow-sm flex items-center justify-center">
                <span className="text-xs text-purple-400">After2</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
      
      {/* Navigation Cards */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase mb-3">快速导航</h2>
        <div className="space-y-3">
          <Link href="/brand-assets" className="flex items-center justify-between bg-white rounded-xl p-4 border border-zinc-100 active:bg-zinc-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center">
                <FolderHeart className="w-5 h-5 text-zinc-600" />
              </div>
              <div>
                <h3 className="font-medium text-zinc-900">品牌资产</h3>
                <p className="text-xs text-zinc-500">管理模特、背景、商品素材</p>
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
                <h3 className="font-medium text-zinc-900">图库</h3>
                <p className="text-xs text-zinc-500">查看生成历史和收藏</p>
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
            <h2 className="text-sm font-semibold text-zinc-500 uppercase">我的图库</h2>
            <Link href="/gallery" className="text-xs text-blue-600 font-medium">查看全部</Link>
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
