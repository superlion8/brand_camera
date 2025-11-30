# 品牌相机 Brand Camera

为服装品牌主理人和买手店打造的AI产品摄影工具，帮助用户快速生成符合品牌调性的商品图和模特展示图。

## ✨ 功能特性

### 📷 相机模块
- 拍摄或上传商品图片
- 选择模特风格（日系/韩系/中式/欧美）
- 选择模特、背景、Vibe 参考图
- AI生成2张商品图 + 2张模特展示图

### ✏️ 图像编辑
- 导入图片进行AI编辑
- 支持自定义提示词
- 灵活的参考图控制

### 📁 品牌资产
- 管理模特、背景、商品素材库
- 系统预设 + 用户自定义
- 从生成历史保存到资产库

### 🖼️ 图片资产
- 保存所有生成历史
- 收藏夹功能
- 支持下载

## 🛠️ 技术栈

- **前端**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **状态管理**: Zustand
- **UI组件**: Radix UI
- **AI**: Google Gemini 3.0 Pro (via @google/genai SDK)
- **数据库**: Supabase
- **部署**: Vercel

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm (推荐) 或 npm

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

复制 `.env.example` 为 `.env.local` 并填写配置：

```bash
cp .env.example .env.local
```

需要配置的环境变量：

```bash
# Supabase (可选，用于持久化存储)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Gemini (必须)
GEMINI_API_KEY=your-gemini-api-key
```

### 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

## 📦 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署完成

## 📱 PWA 支持

应用支持 PWA，可以添加到手机主屏幕使用。

## 📄 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── (main)/            # 主应用页面
│   │   ├── camera/        # 相机模块
│   │   ├── edit/          # 图像编辑
│   │   ├── brand-assets/  # 品牌资产
│   │   └── gallery/       # 图片资产
│   └── api/               # API Routes
├── components/            # React 组件
│   ├── ui/               # 基础UI组件
│   ├── camera/           # 相机相关组件
│   └── shared/           # 共享组件
├── lib/                   # 工具库
├── stores/               # Zustand 状态管理
├── types/                # TypeScript 类型
└── prompts/              # AI 提示词模板
```

## 🔧 API 说明

### POST /api/generate

生成商品图和模特展示图

```typescript
// Request
{
  productImage: string      // base64 商品图 (必须)
  modelImage?: string       // base64 模特参考图
  modelStyle?: 'japanese' | 'korean' | 'chinese' | 'western' | 'auto'
  backgroundImage?: string  // base64 背景参考图
  vibeImage?: string        // base64 Vibe参考图
}

// Response
{
  success: boolean
  images: string[]  // 生成的图片 (base64)
}
```

### POST /api/edit

编辑单张图片

```typescript
// Request
{
  inputImage: string        // base64 输入图片 (必须)
  modelImage?: string
  modelStyle?: string
  backgroundImage?: string
  vibeImage?: string
  customPrompt?: string     // 自定义提示词
}

// Response
{
  success: boolean
  image: string  // 编辑后的图片 (base64)
}
```

## 📝 License

MIT

