# PC Web 开发指南

> 本项目同时支持 Mobile Web 和 PC Web，开发新功能时需要同时考虑两端适配。

## 1. 架构概述

项目采用 **组件级响应式 + 布局切换** 方案：
- 单一代码库，通过 `useIsMobile()` hook 检测设备类型
- 业务逻辑完全共享，UI 布局按需区分
- Mobile 优先开发，PC 适配跟进

## 2. 核心工具

### 设备检测 Hook

```typescript
import { useIsMobile } from "@/hooks/useIsMobile"

// 在组件中使用
const isMobile = useIsMobile(1024) // 1024px 为分界点
const isDesktop = isMobile === false

// 注意：isMobile 可能为 null（SSR 或初始加载时）
if (isMobile === null) {
  return <LoadingState />
}
```

### 响应式布局组件

```typescript
// src/components/layouts/ResponsiveLayout.tsx
// - Mobile: 底部导航栏 (BottomNav)
// - Desktop: 侧边栏 (Sidebar) + 顶部导航 (TopNav)
```

## 3. 开发模式

### 模式 A：简单页面 - 纯 Tailwind 响应式

适用于布局差异小的页面，直接使用 Tailwind 响应式前缀：

```tsx
// ✅ 推荐：一行代码适配两端
<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>

// ✅ 隐藏/显示元素
<button className="md:hidden">Mobile Only</button>
<button className="hidden md:flex">Desktop Only</button>

// ✅ 响应式间距和尺寸
<div className="p-4 md:p-8 max-w-md md:max-w-4xl mx-auto">
```

### 模式 B：复杂页面 - 条件渲染

适用于 Mobile 和 Desktop 布局差异大的页面：

```tsx
// 业务逻辑共享
const [mode, setMode] = useState<PageMode>("main")
const [selectedModel, setSelectedModel] = useState<string | null>(null)
const handleGenerate = async () => { /* ... */ }

// UI 按设备类型区分
return (
  <div className="h-full">
    {isDesktop ? (
      // Desktop: 双栏布局
      <div className="flex gap-8 max-w-5xl mx-auto p-8">
        <div className="w-[380px]">{/* 左栏：预览 */}</div>
        <div className="flex-1">{/* 右栏：设置 */}</div>
      </div>
    ) : (
      // Mobile: 单栏全屏布局
      <div className="flex flex-col h-full">
        <div className="flex-1">{/* 主内容 */}</div>
        <div className="h-20">{/* 底部控制栏 */}</div>
      </div>
    )}
  </div>
)
```

### 模式 C：高复用页面 - 提取逻辑到 Hook

适用于逻辑复杂、需要高度复用的页面：

```tsx
// hooks/useBuyerShowLogic.ts
export function useBuyerShowLogic() {
  const [mode, setMode] = useState<PageMode>("camera")
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  
  const handleCapture = useCallback(() => { /* ... */ }, [])
  const handleGenerate = useCallback(async () => { /* ... */ }, [])
  
  return {
    mode, setMode,
    capturedImage, setCapturedImage,
    handleCapture, handleGenerate,
  }
}

// pages/buyer-show.tsx
export default function BuyerShowPage() {
  const logic = useBuyerShowLogic()
  const isDesktop = useIsMobile(1024) === false
  
  return isDesktop 
    ? <BuyerShowDesktop {...logic} />
    : <BuyerShowMobile {...logic} />
}
```

## 4. PC Web 专属注意事项

### 4.1 相机功能

PC 端不支持拍照，需要隐藏相机相关 UI：

```tsx
// ❌ 错误：PC 端显示拍照按钮
<button onClick={handleCapture}>拍照</button>

// ✅ 正确：仅移动端显示
{!isDesktop && (
  <button onClick={handleCapture}>拍照</button>
)}

// ✅ PC 端替换为上传入口
{isDesktop ? (
  <UploadArea onUpload={handleFileUpload} />
) : (
  <CameraView onCapture={handleCapture} />
)}
```

### 4.2 底部导航栏

ResponsiveLayout 已处理全局底部导航，但某些页面有独立的 BottomNav：

```tsx
// ❌ 错误：强制显示底部导航
<BottomNav forceShow />

// ✅ 正确：仅移动端显示
{!isDesktop && <BottomNav forceShow />}
```

### 4.3 相机覆盖层

网格线、对焦框等仅在移动端相机模式显示：

```tsx
// ❌ 错误：桌面端也显示对焦框
{mode === "camera" && <FocusFrame />}

// ✅ 正确：仅移动端显示
{mode === "camera" && !isDesktop && <FocusFrame />}
```

### 4.4 布局容器

PC 端需要限制最大宽度，居中显示：

```tsx
// ✅ PC 端双栏布局标准结构
<div className="max-w-5xl mx-auto px-8 py-6">
  <div className="flex gap-8">
    <div className="w-[380px] shrink-0">
      {/* 左栏 */}
    </div>
    <div className="flex-1 min-w-0">
      {/* 右栏 */}
    </div>
  </div>
</div>

// ✅ PC 端卡片容器
<div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
  {/* 内容 */}
</div>
```

### 4.5 结果页图片网格

```tsx
// Mobile: 2 列
// Desktop: 4 列，带 hover 效果
<div className={`grid gap-4 ${isDesktop ? 'grid-cols-4' : 'grid-cols-2'}`}>
  {images.map((img, i) => (
    <div key={i} className="group relative">
      <Image src={img} ... />
      {/* 收藏按钮：桌面端 hover 显示，移动端始终显示 */}
      <button className={`absolute top-2 right-2 ${isDesktop ? 'opacity-0 group-hover:opacity-100' : ''}`}>
        <Heart />
      </button>
    </div>
  ))}
</div>
```

## 5. 新功能开发检查清单

开发新页面或功能时，确保检查以下项目：

### 5.1 必须检查

- [ ] 导入 `useIsMobile` hook 并定义 `isDesktop`
- [ ] 相机/拍照功能仅在移动端可用
- [ ] 独立的 BottomNav 添加 `!isDesktop` 条件
- [ ] PC 端有合适的最大宽度和居中布局
- [ ] 翻译文件包含所有新增的文本 key

### 5.2 布局检查

- [ ] Mobile: 全屏/单栏布局，底部操作区
- [ ] Desktop: 双栏布局或网格布局，操作按钮在卡片内
- [ ] 图片/卡片网格在 PC 端有更多列
- [ ] 上传区域在 PC 端尺寸合理（不要全屏高度）

### 5.3 交互检查

- [ ] PC 端支持 hover 效果
- [ ] PC 端按钮尺寸和间距适当增大
- [ ] PC 端表单输入框宽度合理

## 6. 常用 PC 端样式参考

```tsx
// 页面容器
className="max-w-5xl mx-auto px-8 py-6"

// 双栏布局
className="flex gap-8"

// 左栏（固定宽度）
className="w-[380px] shrink-0"

// 右栏（弹性宽度）
className="flex-1 min-w-0"

// 卡片
className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6"

// 段落标题
className="font-semibold text-zinc-900 mb-3"

// 模特/背景选择网格
className="grid grid-cols-5 gap-2"

// 生成按钮
className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"

// 选中状态
className="border-2 border-blue-500 ring-2 ring-blue-500/30"
```

## 7. 文件结构建议

```
src/
├── app/(main)/
│   └── feature-name/
│       └── page.tsx          # 统一入口，根据 isDesktop 渲染不同布局
├── components/
│   ├── layouts/              # 布局组件
│   │   ├── ResponsiveLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── TopNav.tsx
│   └── features/
│       └── feature-name/
│           ├── FeatureLogic.ts      # 共享业务逻辑 hook
│           ├── FeatureMobile.tsx    # 移动端布局（可选）
│           └── FeatureDesktop.tsx   # 桌面端布局（可选）
├── hooks/
│   └── useIsMobile.ts
└── locales/
    ├── zh.ts
    ├── en.ts
    └── ko.ts
```

---

**记住：先确保移动端功能完整，再适配桌面端布局。业务逻辑共享，UI 按需区分。**

