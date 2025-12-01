"use client"

import Image from "next/image"
import Link from "next/link"
import { Camera, Wand2, FolderHeart, Images, ArrowRight, Sparkles, ChevronRight } from "lucide-react"
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
      
      {/* Quick Actions */}
      <div className="px-4 -mt-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Camera Card */}
          <Link href="/camera" className="group">
            <div className="bg-zinc-900 text-white rounded-2xl p-5 h-40 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-800 rounded-full -translate-y-1/2 translate-x-1/2" />
              <Camera className="w-8 h-8 relative z-10" />
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-1">拍摄</h3>
                <p className="text-zinc-400 text-xs">一键生成商品图和模特图</p>
              </div>
            </div>
          </Link>
          
          {/* Edit Card */}
          <Link href="/edit" className="group">
            <div className="bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-2xl p-5 h-40 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/30 rounded-full -translate-y-1/2 translate-x-1/2" />
              <Wand2 className="w-8 h-8 relative z-10" />
              <div className="relative z-10">
                <h3 className="font-bold text-lg mb-1">编辑</h3>
                <p className="text-purple-200 text-xs">AI 智能修图和风格调整</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
      
      {/* Usage Steps */}
      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase mb-3">使用步骤</h2>
        <div className="bg-white rounded-xl border border-zinc-100 p-4">
          <div className="flex items-center justify-between">
            {/* Step 1 */}
            <div className="flex-1 text-center">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <Camera className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-zinc-700 block">拍摄商品</span>
            </div>
            
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
            
            {/* Step 2 */}
            <div className="flex-1 text-center">
              <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-xs font-medium text-zinc-700 block leading-tight">一键生成<br/>商品图和模特图</span>
            </div>
            
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
            
            {/* Step 3 */}
            <div className="flex-1 text-center">
              <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <Wand2 className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-xs font-medium text-zinc-700 block leading-tight">更换模特<br/>和背景</span>
            </div>
          </div>
        </div>
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
