'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { 
  Home, 
  Camera, 
  Images, 
  FolderHeart, 
  Wand2, 
  Sparkles,
  Users,
  Box,
  ScanFace,
  Shirt,
  ImageIcon,
  ChevronDown,
  ChevronRight,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/stores/languageStore'
import { useState } from 'react'
import { useGenerationTaskStore } from '@/stores/generationTaskStore'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  href?: string
  children?: { id: string; label: string; href: string }[]
  badge?: string
}

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['shoot', 'custom'])
  const { tasks } = useGenerationTaskStore()
  
  // Check if any task is currently generating
  const hasActiveTask = tasks.some(task => task.status === 'generating')

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  const navItems: NavItem[] = [
    {
      id: 'home',
      label: t.nav?.home || '首页',
      icon: <Home className="w-5 h-5" />,
      href: '/',
    },
    {
      id: 'shoot',
      label: t.home?.shootModel || '拍模特',
      icon: <ScanFace className="w-5 h-5" />,
      children: [
        { id: 'pro-studio', label: t.home?.proStudio || '专业棚拍', href: '/pro-studio' },
        { id: 'lifestyle', label: t.home?.lifestyleMode || 'LifeStyle 街拍', href: '/lifestyle' },
        { id: 'camera', label: t.home?.modelStudio || '买家秀', href: '/camera' },
        { id: 'social', label: t.home?.socialMode || '社媒种草', href: '/camera/social' },
      ],
    },
    {
      id: 'custom',
      label: t.home?.customShot || '定制拍摄',
      icon: <Sparkles className="w-5 h-5" />,
      children: [
        { id: 'group', label: t.home?.groupShoot || '组图拍摄', href: '/camera/group' },
        { id: 'reference', label: t.home?.referenceShot || '参考图拍摄', href: '/reference-shot' },
        { id: 'studio', label: t.home?.productStudio || '商品棚拍', href: '/studio' },
        { id: 'try-on', label: t.home?.tryOn || '虚拟换装', href: '/try-on' },
      ],
    },
    {
      id: 'model-create',
      label: t.home?.createCustomModel || '创建专属模特',
      icon: <Users className="w-5 h-5" />,
      href: '/model-create',
    },
    {
      id: 'edit',
      label: t.home?.retouchRoom || '修图室',
      icon: <Wand2 className="w-5 h-5" />,
      href: '/edit',
    },
    {
      id: 'brand-assets',
      label: t.nav?.assets || '素材库',
      icon: <FolderHeart className="w-5 h-5" />,
      href: '/brand-assets',
    },
    {
      id: 'gallery',
      label: t.nav?.gallery || '图库',
      icon: hasActiveTask ? <Loader2 className="w-5 h-5 animate-spin" /> : <Images className="w-5 h-5" />,
      href: '/gallery',
      badge: hasActiveTask ? t.common?.generating || '生成中...' : undefined,
    },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside className={cn(
      'bg-white border-r border-zinc-200 flex flex-col h-full',
      className
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-zinc-100">
        <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
          <Image src="/logo.png" alt="Brand Camera" width={22} height={22} className="rounded" />
        </div>
        <div>
          <span className="text-base font-bold text-zinc-900 tracking-tight">
            {t.common?.appName || 'Brand Camera'}
          </span>
          <span className="ml-2 px-1.5 py-0.5 bg-amber-50 rounded-full border border-amber-100 text-[10px] font-bold text-amber-700">
            {t.beta?.tag || 'Beta'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.id}>
              {item.children ? (
                // Group with children
                <div>
                  <button
                    onClick={() => toggleGroup(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    )}
                  >
                    <span className="text-zinc-400">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {expandedGroups.includes(item.id) ? (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    )}
                  </button>
                  {expandedGroups.includes(item.id) && (
                    <ul className="mt-1 ml-4 pl-4 border-l border-zinc-200 space-y-1">
                      {item.children.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={child.href}
                            className={cn(
                              'flex items-center px-3 py-2 rounded-lg text-sm transition-colors',
                              isActive(child.href)
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                // Single item
                <Link
                  href={item.href!}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive(item.href!)
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  )}
                >
                  <span className={cn(
                    isActive(item.href!) ? 'text-blue-600' : item.badge ? 'text-amber-500' : 'text-zinc-400'
                  )}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded-full animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-100">
        <div className="text-xs text-zinc-400 text-center">
          © 2024 Brand Camera
        </div>
      </div>
    </aside>
  )
}



