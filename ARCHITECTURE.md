# Brand Camera 系统架构文档

## 目录
1. [系统概览](#系统概览)
2. [核心模块](#核心模块)
3. [标准数据流](#标准数据流)
4. [功能实现模式](#功能实现模式)
5. [代码复用指南](#代码复用指南)
6. [服务间依赖](#服务间依赖)

---

## 系统概览

### 技术栈
- **前端**: Next.js 14 (App Router) + React 18 + TypeScript
- **样式**: Tailwind CSS + Framer Motion
- **状态管理**: Zustand (全局) + React useState/useRef (局部)
- **后端**: Next.js API Routes
- **数据库**: Supabase (PostgreSQL)
- **存储**: Supabase Storage
- **AI**: Google Gemini (VLM/生图) + Together AI Sora 2 (生视频)
- **认证**: Supabase Auth

### 架构图
```
┌─────────────────────────────────────────────────────────────────┐
│                         前端 (Next.js)                           │
├─────────────────────────────────────────────────────────────────┤
│  Pages (src/app)          │  Components           │  Stores     │
│  ├─ (main)/               │  ├─ layouts/          │  ├─ gallery │
│  │  ├─ camera/            │  │  ├─ Sidebar        │  ├─ task    │
│  │  ├─ gallery/           │  │  ├─ TopNav         │  ├─ asset   │
│  │  ├─ brand-style/       │  │  └─ BottomNav      │  └─ lang    │
│  │  └─ ...                │  ├─ shared/           │             │
│  └─ api/                  │  │  └─ Preloader      │             │
│     ├─ generate*/         │  └─ ui/               │             │
│     ├─ gallery/           │     └─ LoadingGuard   │             │
│     └─ quota/             │                       │             │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       后端服务 (API Routes)                       │
├─────────────────────────────────────────────────────────────────┤
│  lib/                                                           │
│  ├─ auth.ts           → requireAuth() 认证中间件                 │
│  ├─ taskTypes.ts      → 任务类型定义 & 判断函数                   │
│  ├─ genai.ts          → Gemini AI 客户端                         │
│  └─ supabase/                                                   │
│     ├─ generationService.ts  → 图片追加到数据库                   │
│     └─ storage-server.ts     → 上传到 Storage                    │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       外部服务                                    │
├─────────────────────────────────────────────────────────────────┤
│  Supabase          │  Google AI          │  Together AI         │
│  ├─ Auth           │  ├─ Gemini VLM      │  └─ Sora 2 (视频)    │
│  ├─ PostgreSQL     │  └─ Gemini 生图     │                      │
│  └─ Storage        │                     │                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 核心模块

### 1. 认证模块
**文件**: `src/lib/auth.ts`

```typescript
// API 路由中使用
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if ('response' in authResult) return authResult.response
  const { user } = authResult
  // user.id, user.email 可用
}
```

### 2. 任务类型模块
**文件**: `src/lib/taskTypes.ts`

所有任务类型的单一数据源，解决历史数据兼容问题。

```typescript
// 写入数据库：使用常量
import { TaskTypes } from '@/lib/taskTypes'
task_type: TaskTypes.BRAND_STYLE  // 'brand_style'

// 判断类型：使用函数（自动兼容历史变种）
import { isBrandStyleType, isModelType } from '@/lib/taskTypes'
if (isBrandStyleType(item.task_type)) { ... }  // 匹配 brand_style, brandstyle, brand
```

### 3. 生成服务模块
**文件**: `src/lib/supabase/generationService.ts`

后端直接写入数据库，前端不需要写入。

```typescript
// 追加单张图片到 generation 记录
await appendImageToGeneration({
  taskId,
  userId,
  imageIndex: 0,
  imageUrl: 'https://...',
  modelType: 'pro',
  genMode: 'simple',
  taskType: TaskTypes.MODEL_STUDIO,
  inputImageUrl: '...',
  inputParams: { ... }
})

// 上传图片到 Storage
const publicUrl = await uploadImageToStorage(base64, userId, 'generated')
```

### 4. 计费模块
**文件**: `src/app/api/quota/reserve/route.ts`

```typescript
// 前端调用（生成前预扣额度）
await fetch('/api/quota/reserve', {
  method: 'POST',
  body: JSON.stringify({
    taskId,
    imageCount: 4,      // 图片数量
    taskType: 'model_studio'
  })
})

// 计费规则
// - 图片: 1 credit
// - 视频: 10 credits
```

### 5. Gallery 模块
**文件**: `src/stores/galleryStore.ts` + `src/components/shared/GalleryPreloader.tsx`

全局缓存 + 静默预加载。

```typescript
// 获取缓存
const { getCache, setCache } = useGalleryStore()
const cached = getCache('model_buyer')

// 预加载配置（新增 tab 必须添加）
const PRELOAD_TABS = [
  { tab: 'all', subType: '' },
  { tab: 'model', subType: 'buyer' },
  { tab: 'brand', subType: '' },  // ← 新增
]
```

### 6. 状态管理模块

| Store | 文件 | 用途 |
|-------|------|------|
| `galleryStore` | `src/stores/galleryStore.ts` | Gallery 数据缓存 |
| `generationTaskStore` | `src/stores/generationTaskStore.ts` | 生成任务进度追踪 |
| `languageStore` | `src/stores/languageStore.ts` | 多语言 (zh/en/ko) |
| `assetStore` | `src/stores/assetStore.ts` | 用户素材管理 |
| `settingsStore` | `src/stores/settingsStore.ts` | 用户设置 |

---

## 标准数据流

### 图片生成流程
```
┌──────────────────────────────────────────────────────────────────────┐
│                            前端页面                                   │
├──────────────────────────────────────────────────────────────────────┤
│  1. 用户上传图片                                                      │
│  2. checkQuota(numImages) → 检查额度                                  │
│  3. addTask() → 创建本地任务                                          │
│  4. fetch('/api/quota/reserve') → 预扣额度 + 创建 pending 记录         │
│  5. 跳转到 Gallery 页面                                               │
│  6. 后台循环调用 generate API                                         │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         生成 API (后端)                               │
├──────────────────────────────────────────────────────────────────────┤
│  7. requireAuth() → 验证用户                                          │
│  8. 调用 Gemini API 生成图片                                          │
│  9. uploadImageToStorage() → 上传到 Supabase Storage                  │
│ 10. appendImageToGeneration() → 追加到数据库                          │
│ 11. 返回 { success, imageUrl, dbId }                                  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          前端更新状态                                  │
├──────────────────────────────────────────────────────────────────────┤
│ 12. updateImageSlot(taskId, index, { status, imageUrl, dbId })       │
│ 13. Gallery 页面实时显示生成进度                                       │
│ 14. 全部完成后，refreshQuota() 刷新额度                               │
└──────────────────────────────────────────────────────────────────────┘
```

### 数据库字段规范
```sql
-- generations 表核心字段
user_id              UUID        -- 用户 ID
task_id              TEXT        -- 前端生成的任务 ID
task_type            TEXT        -- 任务类型（使用 TaskTypes 常量）
status               TEXT        -- pending / completed / failed
output_image_urls    TEXT[]      -- 生成的图片 URL 数组 ⚠️ 必须用这个字段
input_image_url      TEXT        -- 输入图片
model_image_url      TEXT        -- 模特图片
background_image_url TEXT        -- 背景图片
input_params         JSONB       -- 生成参数
total_images_count   INT         -- 图片数量（用于计费）
```

---

## 功能实现模式

### 新增生图功能标准模板

#### Step 1: 创建页面 `src/app/(main)/[feature]/page.tsx`
```tsx
'use client'

import { useIsDesktop } from '@/hooks/useIsMobile'
import { ScreenLoadingGuard } from '@/components/ui/ScreenLoadingGuard'
import { useTranslation } from '@/stores/languageStore'
import { useQuota } from '@/hooks/useQuota'
import { useGenerationTaskStore } from '@/stores/generationTaskStore'
import { BottomNav } from '@/components/layouts/BottomNav'

export default function FeaturePage() {
  const { isDesktop, isMobile, isLoading } = useIsDesktop()
  const { t } = useTranslation()
  const { checkQuota, refreshQuota } = useQuota()
  const { addTask, updateImageSlot, initImageSlots } = useGenerationTaskStore()
  
  // 防止 hydration 闪烁
  if (isLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }
  
  const handleGenerate = async () => {
    const numImages = 4
    
    // 1. 检查额度
    const hasQuota = await checkQuota(numImages)
    if (!hasQuota) return
    
    // 2. 创建任务
    const taskId = addTask('new_type', inputImage, params, numImages)
    initImageSlots(taskId, numImages)
    
    // 3. 预扣额度
    await fetch('/api/quota/reserve', {
      method: 'POST',
      body: JSON.stringify({
        taskId,
        imageCount: numImages,
        taskType: 'new_type',  // ⚠️ 使用 TaskTypes.NEW_TYPE
      })
    })
    
    // 4. 后台生成
    for (let i = 0; i < numImages; i++) {
      updateImageSlot(taskId, i, { status: 'generating' })
      
      const res = await fetch('/api/generate-new', {
        method: 'POST',
        body: JSON.stringify({ taskId, index: i, ... })
      })
      const result = await res.json()
      
      updateImageSlot(taskId, i, {
        status: result.success ? 'completed' : 'failed',
        imageUrl: result.imageUrl,
        dbId: result.dbId,
      })
    }
    
    refreshQuota()
  }
  
  return (
    <div>
      {/* 页面内容 */}
      {!isDesktop && <BottomNav />}
    </div>
  )
}
```

#### Step 2: 创建 API `src/app/api/generate-[feature]/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getGenAIClient } from '@/lib/genai'
import { appendImageToGeneration, uploadImageToStorage } from '@/lib/supabase/generationService'
import { TaskTypes } from '@/lib/taskTypes'

export const maxDuration = 300  // 5 分钟超时

export async function POST(request: NextRequest) {
  // 1. 认证
  const authResult = await requireAuth(request)
  if ('response' in authResult) return authResult.response
  const { user } = authResult
  
  try {
    const { taskId, index, productImage, ... } = await request.json()
    
    // 2. 调用 AI 生成
    const client = getGenAIClient()
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{ role: 'user', parts: [...] }],
      config: { responseModalities: ['IMAGE'] }
    })
    
    // 3. 上传到 Storage
    const imageUrl = await uploadImageToStorage(base64, user.id, 'generated')
    
    // 4. 保存到数据库
    const { dbId } = await appendImageToGeneration({
      taskId,
      userId: user.id,
      imageIndex: index,
      imageUrl,
      modelType: 'pro',
      genMode: 'simple',
      taskType: TaskTypes.NEW_TYPE,  // ⚠️ 使用常量
      inputImageUrl: productImage,
    })
    
    return NextResponse.json({ success: true, imageUrl, dbId })
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
```

#### Step 3: 注册任务类型
参考 `.cursorrules` 中的"任务类型注册完整流程"。

#### Step 4: 添加翻译
```typescript
// src/locales/zh.ts
export const zh = {
  newFeature: {
    title: '新功能',
    description: '功能描述',
    generate: '开始生成',
  }
}
// 同步更新 en.ts 和 ko.ts
```

#### Step 5: 添加导航入口
- `src/components/layouts/Sidebar.tsx` - PC 侧边栏
- `src/app/(main)/app/page.tsx` - 首页入口卡片

---

## 代码复用指南

### 可复用的工具函数

| 函数 | 文件 | 用途 |
|------|------|------|
| `requireAuth()` | `lib/auth.ts` | API 认证 |
| `getGenAIClient()` | `lib/genai.ts` | Gemini 客户端 |
| `uploadImageToStorage()` | `lib/supabase/generationService.ts` | 上传图片 |
| `appendImageToGeneration()` | `lib/supabase/generationService.ts` | 保存生成结果 |
| `imageToBase64()` | `lib/presets/serverPresets.ts` | URL 转 base64 |
| `generateId()` | `lib/utils.ts` | 生成唯一 ID |
| `isXxxType()` | `lib/taskTypes.ts` | 类型判断 |

### 可复用的 Hooks

| Hook | 文件 | 用途 |
|------|------|------|
| `useIsDesktop()` | `hooks/useIsMobile.ts` | PC/Mobile 判断 + 防闪烁 |
| `useQuota()` | `hooks/useQuota.ts` | 额度检查 |
| `useTranslation()` | `stores/languageStore.ts` | 多语言 |
| `useAuth()` | `components/providers/AuthProvider.tsx` | 用户认证状态 |

### 可复用的组件

| 组件 | 文件 | 用途 |
|------|------|------|
| `ScreenLoadingGuard` | `components/ui/ScreenLoadingGuard.tsx` | 防止页面闪烁 |
| `BottomNav` | `components/layouts/BottomNav.tsx` | 移动端底部导航 |
| `QuotaIndicator` | `components/shared/QuotaIndicator.tsx` | 额度显示 |
| `ImageUploader` | `components/shared/ImageUploader.tsx` | 图片上传 |

---

## 服务间依赖

### 新功能影响范围检查清单

```
┌─ 新功能开发时必须检查 ──────────────────────────────────────────────┐
│                                                                    │
│  1. 类型系统                                                        │
│     ├─ src/lib/taskTypes.ts         (TaskTypes + TYPE_MAP)        │
│     ├─ src/types/index.ts           (GenerationType)               │
│     └─ src/stores/generationTaskStore.ts (TaskType)               │
│                                                                    │
│  2. 计费系统                                                        │
│     └─ src/app/api/quota/reserve/route.ts                         │
│                                                                    │
│  3. Gallery 系统                                                    │
│     ├─ src/app/api/gallery/route.ts        (过滤条件)              │
│     ├─ src/app/(main)/gallery/page.tsx     (tab 显示)             │
│     └─ src/components/shared/GalleryPreloader.tsx (预加载)        │
│                                                                    │
│  4. 导航系统                                                        │
│     ├─ src/components/layouts/Sidebar.tsx   (PC 侧边栏)            │
│     └─ src/app/(main)/app/page.tsx          (首页入口)             │
│                                                                    │
│  5. 国际化                                                          │
│     ├─ src/locales/zh.ts                                          │
│     ├─ src/locales/en.ts                                          │
│     └─ src/locales/ko.ts                                          │
│                                                                    │
│  6. 数据库                                                          │
│     └─ 字段: output_image_urls (不是 image_urls)                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 模块依赖图
```
                    ┌──────────────┐
                    │   用户请求    │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   页面组件    │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
   ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
   │   Hooks   │    │  Stores   │    │    API    │
   │useIsDesktop│   │galleryStore│   │requireAuth│
   │useQuota   │    │taskStore  │    │genService │
   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                    ┌──────▼───────┐
                    │  taskTypes   │  ← 单一数据源
                    └──────────────┘
```

---

## 附录：常用代码片段

### A. API 路由标准模板
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if ('response' in authResult) return authResult.response
  const { user } = authResult

  try {
    const body = await request.json()
    // 业务逻辑
    return NextResponse.json({ success: true, data: ... })
  } catch (error: any) {
    console.error('[API] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
```

### B. 页面组件标准模板
```tsx
'use client'

import { useIsDesktop } from '@/hooks/useIsMobile'
import { ScreenLoadingGuard } from '@/components/ui/ScreenLoadingGuard'
import { useTranslation } from '@/stores/languageStore'
import { BottomNav } from '@/components/layouts/BottomNav'

export default function MyPage() {
  const { isDesktop, isMobile, isLoading } = useIsDesktop()
  const { t } = useTranslation()

  if (isLoading) {
    return <ScreenLoadingGuard><div /></ScreenLoadingGuard>
  }

  return (
    <div className="min-h-full bg-zinc-50">
      {/* 内容 */}
      {!isDesktop && <BottomNav />}
    </div>
  )
}
```

### C. 生成任务标准流程
```typescript
// 1. 检查额度
const hasQuota = await checkQuota(numImages)
if (!hasQuota) return

// 2. 创建本地任务
const taskId = addTask(TaskTypes.XXX, inputImage, params, numImages)
initImageSlots(taskId, numImages)

// 3. 预扣额度（创建 pending 记录）
await fetch('/api/quota/reserve', {
  method: 'POST',
  body: JSON.stringify({ taskId, imageCount: numImages, taskType: TaskTypes.XXX })
})

// 4. 后台循环生成
for (let i = 0; i < numImages; i++) {
  updateImageSlot(taskId, i, { status: 'generating' })
  const result = await fetch('/api/generate-xxx', { ... })
  updateImageSlot(taskId, i, { status: ..., imageUrl: ..., dbId: ... })
}

// 5. 刷新额度
refreshQuota()
```

---

**文档版本**: 1.0.0  
**最后更新**: 2026-01-09
