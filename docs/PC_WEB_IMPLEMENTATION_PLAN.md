# Brand Camera PC Web 版本技术方案

## 一、项目概述

### 1.1 背景
当前 Brand Camera 项目仅支持 Mobile Web UI，需要增加 PC Web 版本支持。采用**方案三：组件级响应式 + 布局切换**，在逻辑复用的同时实现平台差异化 UI。

### 1.2 核心目标
- 保持业务逻辑单一来源，避免重复代码
- Mobile/Desktop UI 独立设计，各自优化体验
- 渐进式迁移，不影响现有功能
- 最小化 SSR hydration 问题

### 1.3 技术栈
- **框架**: Next.js 14.2 (App Router)
- **状态管理**: Zustand (已有)
- **样式**: Tailwind CSS
- **动画**: Framer Motion
- **后端**: Supabase + Next.js API Routes

---

## 二、架构设计

### 2.1 整体架构图

```
src/
├── app/
│   ├── (main)/              # 移动端路由组
│   │   ├── layout.tsx       # 移动端布局 (max-w-md, BottomNav)
│   │   ├── page.tsx         # → 使用 HomePageMobile
│   │   ├── camera/
│   │   │   └── page.tsx     # → 使用 CameraFlowMobile
│   │   └── gallery/
│   │       └── page.tsx     # → 使用 GalleryMobile
│   │
│   ├── (desktop)/           # PC端路由组 (新增)
│   │   ├── layout.tsx       # PC布局 (全宽, Sidebar/TopNav)
│   │   ├── page.tsx         # → 使用 HomePageDesktop
│   │   ├── camera/
│   │   │   └── page.tsx     # → 使用 CameraFlowDesktop
│   │   └── gallery/
│   │       └── page.tsx     # → 使用 GalleryDesktop
│   │
│   └── api/                 # API 路由 (共用)
│
├── components/
│   ├── features/            # 业务功能组件 (新增)
│   │   ├── home/
│   │   │   ├── useHomeLogic.ts      # 首页业务逻辑 Hook
│   │   │   ├── HomePageMobile.tsx   # 移动端 UI
│   │   │   └── HomePageDesktop.tsx  # PC端 UI
│   │   │
│   │   ├── camera/
│   │   │   ├── useCameraFlow.ts     # 拍摄流程逻辑 Hook
│   │   │   ├── CameraFlowMobile.tsx
│   │   │   └── CameraFlowDesktop.tsx
│   │   │
│   │   ├── gallery/
│   │   │   ├── useGalleryLogic.ts
│   │   │   ├── GalleryMobile.tsx
│   │   │   └── GalleryDesktop.tsx
│   │   │
│   │   └── ... (其他功能模块)
│   │
│   ├── layouts/             # 布局组件 (新增)
│   │   ├── MobileLayout.tsx
│   │   ├── DesktopLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── TopNav.tsx
│   │
│   ├── shared/              # 跨平台共享组件 (已有)
│   │   ├── BottomNav.tsx
│   │   └── ...
│   │
│   └── ui/                  # 基础 UI 组件 (已有)
│
├── hooks/
│   ├── useIsMobile.ts       # 设备检测 Hook (新增)
│   └── useMediaQuery.ts     # 媒体查询 Hook (新增)
│
├── stores/                  # Zustand stores (已有, 共用)
└── lib/                     # 工具函数 (已有, 共用)
```

### 2.2 核心设计原则

#### 原则一：逻辑与视图分离
```tsx
// ❌ 错误：逻辑和 UI 耦合
function CameraPage() {
  const [mode, setMode] = useState('camera')
  const [image, setImage] = useState(null)
  // ... 500 行混合代码
  return <div>...</div>
}

// ✅ 正确：逻辑抽离为 Hook
function useCameraFlow() {
  const [mode, setMode] = useState('camera')
  const [image, setImage] = useState(null)
  const capture = () => { /* ... */ }
  const generate = async () => { /* ... */ }
  return { mode, image, capture, generate, ... }
}

function CameraFlowMobile() {
  const logic = useCameraFlow()
  return <MobileUI {...logic} />
}

function CameraFlowDesktop() {
  const logic = useCameraFlow()
  return <DesktopUI {...logic} />
}
```

#### 原则二：平台检测在服务端完成
```tsx
// middleware.ts - 根据 User-Agent 重定向
export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || ''
  const isMobile = /iPhone|iPad|Android|Mobile/i.test(ua)
  
  const pathname = request.nextUrl.pathname
  
  // /camera → /(main)/camera 或 /(desktop)/camera
  if (pathname === '/camera') {
    return NextResponse.rewrite(
      new URL(isMobile ? '/(main)/camera' : '/(desktop)/camera', request.url)
    )
  }
}
```

#### 原则三：响应式断点统一
```ts
// tailwind.config.ts
theme: {
  screens: {
    'sm': '640px',   // 手机横屏
    'md': '768px',   // 平板
    'lg': '1024px',  // 小屏PC
    'xl': '1280px',  // 标准PC
    '2xl': '1536px', // 大屏
  }
}
```

---

## 三、核心模块设计

### 3.1 设备检测 Hook

```tsx
// src/hooks/useIsMobile.ts
import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  
  useEffect(() => {
    const mql = window.matchMedia('(max-width: ' + (breakpoint - 1) + 'px)')
    setIsMobile(mql.matches)
    
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])
  
  return isMobile
}

// 使用时处理 SSR
function MyComponent() {
  const isMobile = useIsMobile()
  
  // SSR 期间返回骨架屏，避免 hydration mismatch
  if (isMobile === null) {
    return <Skeleton />
  }
  
  return isMobile ? <MobileView /> : <DesktopView />
}
```

### 3.2 布局组件

#### 移动端布局 (已有，微调)
```tsx
// src/app/(main)/layout.tsx
export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-50 max-w-md mx-auto shadow-2xl relative">
      <div className="flex-1 overflow-y-auto relative bg-white">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
```

#### PC端布局 (新增)
```tsx
// src/app/(desktop)/layout.tsx
export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-zinc-100">
      {/* 侧边栏 */}
      <Sidebar className="w-64 shrink-0" />
      
      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### 3.3 业务逻辑 Hook 示例

```tsx
// src/components/features/camera/useCameraFlow.ts
import { useState, useRef, useCallback } from 'react'
import { useCameraStore } from '@/stores/cameraStore'
import { useAssetStore } from '@/stores/assetStore'
import { useGenerationTaskStore } from '@/stores/generationTaskStore'

export type CameraMode = 'camera' | 'review' | 'processing' | 'results'

export interface UseCameraFlowReturn {
  // 状态
  mode: CameraMode
  capturedImage: string | null
  selectedModel: Asset | null
  selectedBackground: Asset | null
  generatedImages: string[]
  isGenerating: boolean
  progress: number
  
  // 操作
  capture: () => void
  uploadImage: (file: File) => Promise<void>
  selectModel: (model: Asset | null) => void
  selectBackground: (bg: Asset | null) => void
  startGeneration: () => Promise<void>
  reset: () => void
  
  // 资源
  presetModels: Asset[]
  presetBackgrounds: Asset[]
  userModels: Asset[]
  userBackgrounds: Asset[]
}

export function useCameraFlow(): UseCameraFlowReturn {
  const [mode, setMode] = useState<CameraMode>('camera')
  const [progress, setProgress] = useState(0)
  
  const { 
    capturedImage, setCapturedImage,
    selectedModel, setSelectedModel,
    selectedBackground, setSelectedBackground,
    generatedImages, setGeneratedImages,
    isGenerating, setIsGenerating,
    reset: resetStore
  } = useCameraStore()
  
  const { userModels, userBackgrounds } = useAssetStore()
  const { addTask, updateTask } = useGenerationTaskStore()
  
  const capture = useCallback(() => {
    // 拍照逻辑...
  }, [])
  
  const uploadImage = useCallback(async (file: File) => {
    // 上传逻辑...
  }, [])
  
  const startGeneration = useCallback(async () => {
    setIsGenerating(true)
    setMode('processing')
    
    try {
      // API 调用逻辑...
      // SSE 进度更新...
    } finally {
      setIsGenerating(false)
      setMode('results')
    }
  }, [capturedImage, selectedModel, selectedBackground])
  
  return {
    mode,
    capturedImage,
    selectedModel,
    selectedBackground,
    generatedImages,
    isGenerating,
    progress,
    capture,
    uploadImage,
    selectModel: setSelectedModel,
    selectBackground: setSelectedBackground,
    startGeneration,
    reset: resetStore,
    presetModels: PRESET_MODELS,
    presetBackgrounds: PRESET_BACKGROUNDS,
    userModels,
    userBackgrounds,
  }
}
```

### 3.4 平台差异化 UI 示例

#### 移动端 Camera UI
```tsx
// src/components/features/camera/CameraFlowMobile.tsx
export function CameraFlowMobile() {
  const logic = useCameraFlow()
  
  return (
    <div className="h-full flex flex-col">
      {/* 全屏相机预览 */}
      {logic.mode === 'camera' && (
        <div className="flex-1 relative">
          <Webcam className="absolute inset-0" />
          <button 
            onClick={logic.capture}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white"
          />
        </div>
      )}
      
      {/* 底部选择器 - 水平滚动 */}
      {logic.mode === 'review' && (
        <>
          <ImagePreview image={logic.capturedImage} />
          <div className="h-32 overflow-x-auto flex gap-2 p-4">
            {logic.presetModels.map(model => (
              <ModelCard key={model.id} model={model} />
            ))}
          </div>
        </>
      )}
      
      {/* 生成中 - 全屏进度 */}
      {logic.mode === 'processing' && (
        <ProcessingOverlay progress={logic.progress} />
      )}
      
      {/* 结果 - 垂直滚动 */}
      {logic.mode === 'results' && (
        <ResultsGrid images={logic.generatedImages} columns={2} />
      )}
    </div>
  )
}
```

#### PC端 Camera UI
```tsx
// src/components/features/camera/CameraFlowDesktop.tsx
export function CameraFlowDesktop() {
  const logic = useCameraFlow()
  
  return (
    <div className="h-full flex gap-6">
      {/* 左侧：预览区 */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex-1 bg-zinc-900 rounded-2xl overflow-hidden relative">
          {logic.mode === 'camera' && <Webcam />}
          {logic.mode === 'review' && <ImagePreview image={logic.capturedImage} />}
          {logic.mode === 'processing' && <ProcessingOverlay progress={logic.progress} />}
        </div>
        
        {/* 操作按钮 */}
        <div className="flex gap-4 justify-center">
          <Button onClick={logic.capture}>拍照</Button>
          <Button onClick={logic.uploadImage}>上传</Button>
          <Button onClick={logic.startGeneration} disabled={!logic.capturedImage}>
            生成
          </Button>
        </div>
      </div>
      
      {/* 右侧：选项面板 */}
      <div className="w-80 bg-white rounded-2xl p-6 space-y-6">
        {/* 模特选择 - 网格布局 */}
        <section>
          <h3 className="font-semibold mb-3">选择模特</h3>
          <div className="grid grid-cols-3 gap-2">
            {logic.presetModels.map(model => (
              <ModelCard 
                key={model.id} 
                model={model}
                selected={logic.selectedModel?.id === model.id}
                onClick={() => logic.selectModel(model)}
              />
            ))}
          </div>
        </section>
        
        {/* 背景选择 */}
        <section>
          <h3 className="font-semibold mb-3">选择背景</h3>
          <div className="grid grid-cols-3 gap-2">
            {logic.presetBackgrounds.map(bg => (
              <BackgroundCard key={bg.id} background={bg} />
            ))}
          </div>
        </section>
      </div>
      
      {/* 结果展示 - 弹出面板 */}
      {logic.mode === 'results' && (
        <ResultsPanel 
          images={logic.generatedImages} 
          onClose={() => logic.reset()}
        />
      )}
    </div>
  )
}
```

---

## 四、路由与中间件

### 4.1 路由结构

| 功能 | 移动端路由 | PC端路由 | 统一入口 |
|------|-----------|---------|---------|
| 首页 | /(main)/ | /(desktop)/ | / |
| 买家秀 | /(main)/camera | /(desktop)/camera | /camera |
| 专业棚拍 | /(main)/pro-studio | /(desktop)/pro-studio | /pro-studio |
| 图库 | /(main)/gallery | /(desktop)/gallery | /gallery |
| 素材库 | /(main)/brand-assets | /(desktop)/brand-assets | /brand-assets |

### 4.2 中间件配置

```tsx
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MOBILE_ROUTES = [
  '/',
  '/camera',
  '/pro-studio',
  '/gallery',
  '/brand-assets',
  '/edit',
  '/lifestyle',
  '/reference-shot',
  '/studio',
  '/try-on',
  '/model-create',
]

function isMobileUserAgent(ua: string): boolean {
  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua)
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ua = request.headers.get('user-agent') || ''
  const isMobile = isMobileUserAgent(ua)
  
  // 只处理需要分流的路由
  if (!MOBILE_ROUTES.includes(pathname)) {
    return NextResponse.next()
  }
  
  // 已经在正确的路由组内，不处理
  if (pathname.startsWith('/(main)') || pathname.startsWith('/(desktop)')) {
    return NextResponse.next()
  }
  
  // 重写到对应的路由组
  const targetPath = isMobile 
    ? '/(main)' + (pathname === '/' ? '' : pathname)
    : '/(desktop)' + (pathname === '/' ? '' : pathname)
  
  return NextResponse.rewrite(new URL(targetPath, request.url))
}

export const config = {
  matcher: [
    '/',
    '/camera/:path*',
    '/pro-studio/:path*',
    '/gallery/:path*',
    '/brand-assets/:path*',
    '/edit/:path*',
    '/lifestyle/:path*',
    '/reference-shot/:path*',
    '/studio/:path*',
    '/try-on/:path*',
    '/model-create/:path*',
  ],
}
```

---

## 五、实施计划

### 第一阶段：基础设施 (Week 1)

| 任务 | 优先级 | 预估工时 |
|------|--------|---------|
| 创建 (desktop) 路由组结构 | P0 | 2h |
| 实现 useIsMobile Hook | P0 | 1h |
| 创建 DesktopLayout 组件 | P0 | 4h |
| 配置中间件路由分流 | P0 | 2h |
| 创建 Sidebar 和 TopNav | P1 | 6h |

**交付物**: PC 端可访问空白页面，路由分流正常工作

### 第二阶段：首页迁移 (Week 2)

| 任务 | 优先级 | 预估工时 |
|------|--------|---------|
| 抽离 useHomeLogic Hook | P0 | 4h |
| 创建 HomePageDesktop | P0 | 8h |
| 重构 HomePageMobile 使用 Hook | P1 | 4h |
| PC 首页样式优化 | P1 | 4h |

**交付物**: PC 端首页完整可用

### 第三阶段：核心功能迁移 (Week 3-4)

| 任务 | 优先级 | 预估工时 |
|------|--------|---------|
| Camera 流程 Hook 抽离 | P0 | 8h |
| CameraFlowDesktop 实现 | P0 | 12h |
| Gallery Hook 抽离 | P0 | 6h |
| GalleryDesktop 实现 | P0 | 10h |
| Pro Studio PC 版 | P1 | 8h |

**交付物**: 买家秀、图库 PC 版完整可用

### 第四阶段：完善与优化 (Week 5-6)

| 任务 | 优先级 | 预估工时 |
|------|--------|---------|
| 其他页面 PC 版 | P1 | 20h |
| 键盘快捷键支持 | P2 | 4h |
| 拖拽上传优化 | P2 | 4h |
| 多面板/分屏支持 | P2 | 8h |
| 性能优化 | P1 | 6h |
| E2E 测试 | P1 | 8h |

**交付物**: 全功能 PC 版发布

---

## 六、PC 端 UI 设计规范

### 6.1 布局规范

```
+------------------------------------------------------------+
|  Logo    首页  拍模特  图库  素材     [搜索]  [配额] [用户] |  <- TopNav (h-16)
+--------+---------------------------------------------------+
|        |                                                   |
|  导航  |              主内容区                              |
|  菜单  |        (根据页面不同布局)                          |
|        |                                                   |
|  w-64  |                                                   |
|        |                                                   |
|        |                                                   |
|        |                                                   |
+--------+---------------------------------------------------+
```

### 6.2 交互差异

| 交互 | 移动端 | PC端 |
|------|--------|------|
| 图片选择 | 单击选中 | 单击预览，双击选中 |
| 图片上传 | 点击按钮 | 点击按钮 + 拖拽上传 |
| 结果展示 | 全屏滑动 | 侧边面板/弹窗 |
| 导航 | 底部 Tab | 顶部 + 侧边栏 |
| 列表滚动 | 下拉刷新 | 滚动加载 |
| 长按操作 | 长按菜单 | 右键菜单 |

### 6.3 响应式断点

```css
/* 移动端优先，PC 端覆盖 */
.card-grid {
  @apply grid grid-cols-2 gap-2;        /* 默认：移动端 2 列 */
  @apply md:grid-cols-3 md:gap-3;       /* 平板：3 列 */
  @apply lg:grid-cols-4 lg:gap-4;       /* PC：4 列 */
  @apply xl:grid-cols-5;                /* 大屏：5 列 */
}
```

---

## 七、风险与应对

### 7.1 SSR Hydration Mismatch

**风险**: 服务端和客户端渲染的 UI 不一致

**应对**:
1. 使用 useIsMobile 返回 null 期间显示骨架屏
2. 关键布局差异通过中间件在服务端决定
3. 使用 suppressHydrationWarning 处理无法避免的场景

### 7.2 代码重复

**风险**: Mobile/Desktop UI 组件有大量相似代码

**应对**:
1. 提取共享的子组件（如 ModelCard, ImagePreview）
2. 使用 variants 模式处理微小差异
3. 定期 code review 识别可复用部分

### 7.3 功能不同步

**风险**: 新功能只在一端实现

**应对**:
1. 任务必须同时包含 Mobile + Desktop UI
2. 业务逻辑 Hook 优先开发，UI 并行开发
3. CI 检查两端路由是否对齐

---

## 八、验收标准

### 8.1 功能完整性
- [ ] 所有移动端功能在 PC 端可用
- [ ] API 调用、状态管理完全复用
- [ ] 图片上传、生成、下载流程正常

### 8.2 用户体验
- [ ] PC 端交互符合桌面习惯（右键菜单、键盘快捷键）
- [ ] 页面加载时间 < 3s
- [ ] 无明显布局抖动

### 8.3 代码质量
- [ ] 业务逻辑 Hook 覆盖率 > 80%
- [ ] TypeScript 类型完整
- [ ] 无 ESLint 警告

---

## 九、附录

### A. 文件迁移清单

| 原文件 | 抽离 Hook | Mobile UI | Desktop UI |
|--------|----------|-----------|------------|
| (main)/page.tsx | useHomeLogic.ts | HomePageMobile.tsx | HomePageDesktop.tsx |
| (main)/camera/page.tsx | useCameraFlow.ts | CameraFlowMobile.tsx | CameraFlowDesktop.tsx |
| (main)/gallery/page.tsx | useGalleryLogic.ts | GalleryMobile.tsx | GalleryDesktop.tsx |
| (main)/pro-studio/page.tsx | useProStudioFlow.ts | ProStudioMobile.tsx | ProStudioDesktop.tsx |
| (main)/lifestyle/page.tsx | useLifestyleFlow.ts | LifestyleMobile.tsx | LifestyleDesktop.tsx |
| (main)/studio/page.tsx | useStudioFlow.ts | StudioMobile.tsx | StudioDesktop.tsx |
| (main)/edit/page.tsx | useEditFlow.ts | EditMobile.tsx | EditDesktop.tsx |
| (main)/brand-assets/page.tsx | useBrandAssets.ts | BrandAssetsMobile.tsx | BrandAssetsDesktop.tsx |
| (main)/model-create/page.tsx | useModelCreate.ts | ModelCreateMobile.tsx | ModelCreateDesktop.tsx |
| (main)/reference-shot/page.tsx | useReferenceShot.ts | ReferenceShotMobile.tsx | ReferenceShotDesktop.tsx |
| (main)/try-on/page.tsx | useTryOn.ts | TryOnMobile.tsx | TryOnDesktop.tsx |

### B. 共享组件清单

| 组件 | 用途 | 平台 |
|------|------|------|
| ModelCard | 模特选择卡片 | 共享 |
| BackgroundCard | 背景选择卡片 | 共享 |
| ProductCard | 商品卡片 | 共享 |
| ImagePreview | 图片预览 | 共享 |
| ProcessingOverlay | 生成进度遮罩 | 共享 |
| ResultsGrid | 结果网格 | 共享（列数响应式） |
| QuotaIndicator | 配额显示 | 共享 |
| LanguageSwitcher | 语言切换 | 共享 |
| UserMenu | 用户菜单 | 共享 |

### C. 参考资源

- [Next.js Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups)
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Zustand Best Practices](https://docs.pmnd.rs/zustand/guides/practice)
- [Framer Motion Layout Animations](https://www.framer.com/motion/layout-animations/)
