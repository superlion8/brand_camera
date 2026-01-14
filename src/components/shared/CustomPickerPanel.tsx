"use client"

import { memo, ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { AssetGrid } from "@/components/shared/AssetGrid"
import { Asset } from "@/types"

type ThemeColor = 'blue' | 'purple' | 'pink' | 'amber'

interface CustomPickerPanelProps {
  open: boolean
  onClose: () => void
  themeColor?: ThemeColor
  // Tab configuration
  tabs: Array<{ id: string; label: string }>
  activeTab: string
  onTabChange: (tabId: string) => void
  // Model selection
  modelItems: Asset[]
  selectedModelId: string | null
  onSelectModel: (id: string | null) => void
  onModelUpload?: () => void
  // Background/Scene selection
  bgItems?: Asset[]
  selectedBgId: string | null
  onSelectBg: (id: string | null) => void
  onBgUpload?: () => void
  // Custom background content (for pro-studio's BackgroundGrid)
  renderBgContent?: () => ReactNode
  // Common
  onZoom?: (url: string) => void
  // Translations
  t: {
    customConfig?: string
    nextStep?: string
    selectModel?: string
    selectBg?: string
    clearSelection?: string
    upload?: string
  }
}

const themeStyles: Record<ThemeColor, { button: string; tab: string; clear: string }> = {
  blue: {
    button: 'bg-blue-600 hover:bg-blue-700',
    tab: 'bg-blue-600 text-white',
    clear: 'text-blue-600',
  },
  purple: {
    button: 'bg-purple-600 hover:bg-purple-700',
    tab: 'bg-purple-600 text-white',
    clear: 'text-purple-600',
  },
  pink: {
    button: 'bg-pink-500 hover:bg-pink-600',
    tab: 'bg-pink-500 text-white',
    clear: 'text-pink-500',
  },
  amber: {
    button: 'bg-amber-500 hover:bg-amber-600',
    tab: 'bg-amber-500 text-white',
    clear: 'text-amber-500',
  },
}

export const CustomPickerPanel = memo(function CustomPickerPanel({
  open,
  onClose,
  themeColor = 'blue',
  tabs,
  activeTab,
  onTabChange,
  modelItems,
  selectedModelId,
  onSelectModel,
  onModelUpload,
  bgItems = [],
  selectedBgId,
  onSelectBg,
  onBgUpload,
  renderBgContent,
  onZoom,
  t,
}: CustomPickerPanelProps) {
  const theme = themeStyles[themeColor]
  
  // Determine which tab is for models and which is for backgrounds
  const modelTabId = tabs[0]?.id || 'model'
  const bgTabId = tabs[1]?.id || 'bg'

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />
          <motion.div 
            initial={{ y: "100%" }} 
            animate={{ y: 0 }} 
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 h-[80%] bg-white dark:bg-zinc-900 rounded-t-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
              <span className="font-semibold text-lg">{t.customConfig || '自定义配置'}</span>
              <button 
                onClick={onClose} 
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full ${theme.button} text-white font-medium text-sm transition-colors`}
              >
                {t.nextStep || '下一步'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="p-2 flex gap-2 border-b overflow-x-auto shrink-0">
              {tabs.map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id 
                      ? theme.tab
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 p-4">
              {activeTab === modelTabId && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-600">{t.selectModel || '选择模特（不选则随机）'}</span>
                    {selectedModelId && (
                      <button 
                        onClick={() => onSelectModel(null)}
                        className={`text-xs ${theme.clear}`}
                      >
                        {t.clearSelection || '清除选择'}
                      </button>
                    )}
                  </div>
                  <AssetGrid 
                    items={modelItems} 
                    selectedId={selectedModelId} 
                    onSelect={(id) => onSelectModel(selectedModelId === id ? null : id)}
                    onUpload={onModelUpload}
                    onZoom={onZoom}
                    uploadIcon="plus"
                    uploadLabel={t.upload || '上传'}
                  />
                </div>
              )}
              {activeTab === bgTabId && (
                renderBgContent ? renderBgContent() : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">{t.selectBg || '选择背景（不选则随机）'}</span>
                      {selectedBgId && (
                        <button 
                          onClick={() => onSelectBg(null)}
                          className={`text-xs ${theme.clear}`}
                        >
                          {t.clearSelection || '清除选择'}
                        </button>
                      )}
                    </div>
                    <AssetGrid 
                      items={bgItems} 
                      selectedId={selectedBgId} 
                      onSelect={(id) => onSelectBg(selectedBgId === id ? null : id)}
                      onUpload={onBgUpload}
                      onZoom={onZoom}
                      uploadIcon="plus"
                      uploadLabel={t.upload || '上传'}
                    />
                  </div>
                )
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
})
