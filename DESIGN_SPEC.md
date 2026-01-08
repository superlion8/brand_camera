# Brand Camera - UI/UX 设计规范

> **设计理念**: 简约、专业、高效  
> **主题**: 浅色主题（Light Mode）  
> **最后更新**: 2026-01-09

---

## 1. 色彩系统

### 1.1 主色板

```css
:root {
  /* 主色 - 蓝色系 */
  --primary: #2563eb;           /* blue-600 - 主要按钮、链接 */
  --primary-light: #3b82f6;     /* blue-500 - hover 状态 */
  --primary-dark: #1d4ed8;      /* blue-700 - active 状态 */
  
  /* 强调色 - 橙色/琥珀色 */
  --accent: #f59e0b;            /* amber-500 - CTA、NEW 标签 */
  --accent-light: #fbbf24;      /* amber-400 */
  
  /* 背景色 */
  --background: #ffffff;        /* 页面背景 */
  --background-secondary: #f4f4f5;  /* zinc-100 - 次级背景 */
  --background-tertiary: #fafafa;   /* 卡片内嵌背景 */
  
  /* 表面色 */
  --surface: #ffffff;           /* 卡片背景 */
  --surface-elevated: #ffffff;  /* 浮层背景 */
  
  /* 文字色 */
  --text-primary: #18181b;      /* zinc-900 */
  --text-secondary: #52525b;    /* zinc-600 */
  --text-tertiary: #a1a1aa;     /* zinc-400 */
  --text-inverse: #ffffff;      /* 深色背景上的文字 */
  
  /* 边框色 */
  --border: #e4e4e7;            /* zinc-200 */
  --border-light: #f4f4f5;      /* zinc-100 */
  
  /* 状态色 */
  --success: #22c55e;           /* green-500 */
  --warning: #f59e0b;           /* amber-500 */
  --error: #ef4444;             /* red-500 */
  --info: #3b82f6;              /* blue-500 */
}
```

### 1.2 Tailwind 使用规范

```jsx
// 主要按钮
<button className="bg-blue-600 hover:bg-blue-700 text-white" />

// 次要按钮
<button className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900" />

// 卡片
<div className="bg-white rounded-2xl shadow-sm border border-zinc-100" />

// 选中状态
<div className="border-2 border-blue-500 ring-2 ring-blue-500/30" />

// 文字层级
<h1 className="text-zinc-900 font-bold" />      // 主标题
<p className="text-zinc-600" />                  // 正文
<span className="text-zinc-400" />               // 辅助文字
```

---

## 2. 字体系统

### 2.1 字体家族

```css
font-family: 'PingFang SC', 'Noto Sans SC', system-ui, sans-serif;
```

### 2.2 字体层级

| 用途 | Tailwind 类 | 示例 |
|------|------------|------|
| 页面大标题 | `text-2xl font-bold` | 24px, 700 |
| 区块标题 | `text-xl font-semibold` | 20px, 600 |
| 卡片标题 | `text-lg font-medium` | 18px, 500 |
| 正文 | `text-base` | 16px, 400 |
| 辅助文字 | `text-sm text-zinc-500` | 14px, 400 |
| 标签/徽章 | `text-xs font-medium` | 12px, 500 |

---

## 3. 间距系统

使用 Tailwind 4px 基础单位：

```jsx
// 常用间距
gap-1    // 4px
gap-2    // 8px
gap-3    // 12px
gap-4    // 16px
gap-6    // 24px
gap-8    // 32px

// 页面容器内边距
px-4     // 移动端
px-6 lg:px-8  // PC 端
```

---

## 4. 圆角系统

```jsx
rounded-lg      // 8px - 小按钮、输入框
rounded-xl      // 12px - 普通按钮、小卡片
rounded-2xl     // 16px - 大卡片、面板
rounded-3xl     // 24px - 特大卡片
rounded-full    // 圆形 - 头像、标签
```

---

## 5. 阴影系统

```jsx
shadow-sm      // 轻柔阴影 - 默认卡片
shadow         // 中等阴影 - hover 状态
shadow-lg      // 较重阴影 - 浮层、Modal
```

---

## 6. 响应式布局

### 6.1 断点定义

| 断点 | 宽度 | 设备 |
|------|------|------|
| (默认) | < 640px | 手机 |
| `sm` | ≥ 640px | 大手机 |
| `md` | ≥ 768px | 平板 |
| `lg` | ≥ 1024px | PC |
| `xl` | ≥ 1280px | 大屏 PC |

### 6.2 PC 端布局结构

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Top Navigation Bar (64px)                         │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                       │
│   Sidebar    │              Main Content Area                        │
│   (240px)    │           (max-width: 1400px, centered)               │
│              │                                                       │
│  ┌────────┐  │      ┌─────────────────────────────────────┐         │
│  │ 首页   │  │      │          Page Content               │         │
│  ├────────┤  │      │                                     │         │
│  │ 拍模特 │  │      │                                     │         │
│  │  ├─    │  │      │                                     │         │
│  │  └─    │  │      └─────────────────────────────────────┘         │
│  ├────────┤  │                                                       │
│  │ 图库   │  │                                                       │
│  └────────┘  │                                                       │
│              │                                                       │
└──────────────┴──────────────────────────────────────────────────────┘
```

### 6.3 移动端布局结构

```
┌────────────────────────────┐
│        Status Bar          │
├────────────────────────────┤
│                            │
│                            │
│       Main Content         │
│     (full width, px-4)     │
│                            │
│                            │
├────────────────────────────┤
│   Bottom Navigation (64px) │
│    Safe Area Padding       │
└────────────────────────────┘
```

### 6.4 尺寸规范

```jsx
// PC 侧边栏
const sidebarWidth = 'w-60'  // 240px

// 顶部导航
const topNavHeight = 'h-16'  // 64px

// 移动端底部导航
const bottomNavHeight = 'h-16'  // 64px + safe area

// 内容区最大宽度
const contentMaxWidth = 'max-w-6xl'  // 1152px
const panelMaxWidth = 'max-w-4xl'    // 896px
```

---

## 7. 组件规范

### 7.1 按钮

```jsx
// 主要按钮
<button className="h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors">
  开始生成
</button>

// 次要按钮
<button className="h-12 px-6 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium rounded-xl transition-colors">
  取消
</button>

// 小按钮
<button className="h-9 px-4 text-sm rounded-lg">
  编辑
</button>

// 图标按钮
<button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100">
  <Icon className="w-5 h-5" />
</button>
```

### 7.2 卡片

```jsx
// 标准卡片
<div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
  {/* 内容 */}
</div>

// 可点击卡片
<div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 hover:shadow-md hover:border-zinc-200 transition-all cursor-pointer">
  {/* 内容 */}
</div>
```

### 7.3 输入框

```jsx
<input 
  className="w-full h-12 px-4 bg-zinc-100 border-0 rounded-xl text-zinc-900 placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
  placeholder="请输入..."
/>
```

### 7.4 标签/徽章

```jsx
// NEW 标签
<span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
  NEW
</span>

// 状态标签
<span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
  已完成
</span>

// Tab 选中态
<button className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-full">
  全部
</button>

// Tab 未选中态
<button className="px-4 py-2 bg-zinc-100 text-zinc-600 text-sm font-medium rounded-full hover:bg-zinc-200">
  模特
</button>
```

### 7.5 图片网格

```jsx
// 移动端 2 列
<div className="grid grid-cols-2 gap-3">

// PC 端 3-4 列
<div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// 图片卡片
<div className="aspect-[3/4] rounded-xl overflow-hidden relative group">
  <img className="w-full h-full object-cover" />
  {/* hover 时显示操作 */}
  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
    {/* 操作按钮 */}
  </div>
</div>
```

---

## 8. 动画规范

### 8.1 Tailwind 过渡

```jsx
// 颜色/背景过渡
className="transition-colors"

// 全属性过渡
className="transition-all"

// 缩放过渡（按钮点击）
className="active:scale-95 transition-transform"
```

### 8.2 Framer Motion

```jsx
// 淡入上滑
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
}

// 列表交错动画
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}
```

---

## 9. 图标规范

使用 **Lucide React** 图标库：

```jsx
import { Camera, Image, Heart, Download, Share2 } from 'lucide-react'

// 标准尺寸
<Camera className="w-5 h-5" />      // 20px - 按钮/列表图标
<Camera className="w-6 h-6" />      // 24px - 导航图标
<Camera className="w-8 h-8" />      // 32px - 大图标
```

---

## 10. 安全区域

```jsx
// 顶部安全区
className="pt-safe"  // padding-top: env(safe-area-inset-top)

// 底部安全区
className="pb-safe"  // padding-bottom: max(env(safe-area-inset-bottom), 16px)

// 底部导航间距
className="mb-nav"   // margin-bottom: calc(64px + safe-area)
```

---

## 11. 页面模板

### 11.1 移动端页面

```tsx
export default function MobilePage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 顶部区域 */}
      <div className="sticky top-0 z-10 bg-white border-b border-zinc-100 px-4 py-3">
        <h1 className="text-lg font-semibold">页面标题</h1>
      </div>
      
      {/* 内容区域 */}
      <div className="px-4 py-4 pb-24">
        {/* 页面内容 */}
      </div>
      
      {/* 底部导航 */}
      <BottomNav />
    </div>
  )
}
```

### 11.2 PC 端页面

```tsx
export default function DesktopPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* 已有 Sidebar + TopNav */}
      
      {/* 内容区域 */}
      <div className="max-w-6xl mx-auto px-8 py-6">
        {/* 双栏布局 */}
        <div className="flex gap-8">
          <div className="w-[400px] shrink-0">
            {/* 左栏 - 操作面板 */}
          </div>
          <div className="flex-1 min-w-0">
            {/* 右栏 - 结果展示 */}
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## 12. 设计原则

### 12.1 核心原则

| 原则 | 描述 |
|------|------|
| **简约** | 减少视觉噪音，突出核心功能 |
| **专业** | 传递品牌摄影的专业质感 |
| **高效** | 最少步骤完成任务 |
| **一致** | 相似功能使用相似交互模式 |

### 12.2 移动端优先

- 默认设计移动端，再适配 PC
- 移动端使用底部导航
- PC 端使用侧边栏 + 顶部导航

### 12.3 反馈即时

- 所有可交互元素必须有 hover/active 状态
- 加载状态使用骨架屏或 Spinner
- 操作成功/失败显示 Toast 提示

---

**文档版本**: 2.0.0  
**合并自**: UIUX_DESIGN_SPEC.md + PC_WEB_DESIGN_SPEC.md
