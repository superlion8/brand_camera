# 品牌相机 - 技术架构文档

## 1. 项目概述

**品牌相机** 是一款面向服装品牌主理人和买手店的移动端优先 Web App，帮助用户快速生成符合品牌调性的商品图和模特展示图。

### 1.1 核心功能模块

| 模块 | 功能描述 |
|------|----------|
| 相机 | 拍摄/上传商品，AI生成商品图和模特展示图 |
| 图像编辑 | 导入图片，结合素材和prompt进行AI编辑 |
| 品牌资产 | 管理模特、背景、商品素材库 |
| 图片资产 | 生成历史、收藏夹、下载管理 |

---

## 2. 技术栈选型

### 2.1 前端技术栈

```
框架: Next.js 14 (App Router)
语言: TypeScript
样式: Tailwind CSS + Framer Motion
状态管理: Zustand
表单处理: React Hook Form + Zod
UI组件: Radix UI (无障碍组件基础)
相机功能: react-webcam
图片处理: browser-image-compression
PWA: next-pwa
```

### 2.2 后端技术栈

```
平台: Vercel (Serverless Functions)
数据库: Supabase PostgreSQL
认证: Supabase Auth (支持邮箱、微信、手机号)
存储: Supabase Storage (图片资产)
实时订阅: Supabase Realtime
AI SDK: @google/genai ^0.7.0 (通过 API Key 调用 Vertex AI)
AI模型: gemini-3-pro-image-preview (Gemini 3.0 Pro Image Generation)
```

### 2.3 开发工具

```
包管理: pnpm
代码规范: ESLint + Prettier
测试: Vitest + Playwright
CI/CD: GitHub Actions + Vercel
监控: Vercel Analytics + Sentry
```

---

## 3. 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端 (PWA)                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │   相机   │ │ 图像编辑 │ │ 品牌资产 │ │ 图片资产 │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │            │                  │
│  ┌────┴────────────┴────────────┴────────────┴────┐            │
│  │              Zustand 状态管理                   │            │
│  └─────────────────────┬───────────────────────────┘            │
└────────────────────────┼────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Next.js API Routes                        │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐            │  │
│  │  │ /api/gen   │ │ /api/edit  │ │ /api/asset │            │  │
│  │  │ (图片生成) │ │ (图片编辑) │ │ (资产管理) │            │  │
│  │  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘            │  │
│  └────────┼──────────────┼──────────────┼───────────────────┘  │
└───────────┼──────────────┼──────────────┼──────────────────────┘
            │              │              │
            ▼              ▼              ▼
┌───────────────────┐  ┌────────────────────────────────────────┐
│  Vertex AI (API)  │  │           Supabase                      │
│   ┌───────────┐   │  │  ┌──────────┐ ┌────────┐ ┌──────────┐  │
│   │ Gemini 3  │   │  │  │PostgreSQL│ │Storage │ │  Auth    │  │
│   │Pro Image  │   │  │  │(元数据)  │ │(图片)  │ │(用户)    │  │
│   └───────────┘   │  │  └──────────┘ └────────┘ └──────────┘  │
└───────────────────┘  └────────────────────────────────────────┘
```

---

## 4. 数据库设计

### 4.1 ER 图

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    users     │       │    brands    │       │   presets    │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │──┐    │ id (PK)      │       │ id (PK)      │
│ email        │  │    │ user_id (FK) │◄──┐   │ type         │
│ avatar_url   │  │    │ name         │   │   │ name         │
│ created_at   │  │    │ logo_url     │   │   │ image_url    │
└──────────────┘  │    │ style_tags   │   │   │ tags         │
                  │    └──────────────┘   │   │ is_system    │
                  │                       │   └──────────────┘
                  │    ┌──────────────┐   │
                  │    │brand_assets  │   │
                  │    ├──────────────┤   │
                  │    │ id (PK)      │   │
                  └───►│ user_id (FK) │   │
                       │ brand_id(FK) │───┘
                       │ type         │  (model/background/product)
                       │ image_url    │
                       │ tags         │
                       │ created_at   │
                       └──────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ generations  │       │  favorites   │       │  collections │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ user_id (FK) │◄──────│ user_id (FK) │◄──────│ user_id (FK) │
│ input_url    │       │ gen_id (FK)  │───┐   │ name         │
│ output_urls  │◄──────┤ collection_id│   │   │ cover_url    │
│ prompt       │   │   │ created_at   │   │   │ created_at   │
│ params       │   │   └──────────────┘   │   └──────────────┘
│ type         │   │                      │
│ created_at   │   └──────────────────────┘
└──────────────┘
```

### 4.2 表结构详情

```sql
-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  display_name TEXT,
  subscription_tier TEXT DEFAULT 'free', -- free/pro/enterprise
  credits_remaining INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 品牌表
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  style_tags TEXT[], -- 品牌风格标签
  color_palette JSONB, -- 品牌色板
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 品牌资产表 (模特/背景/商品)
CREATE TABLE brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('model', 'background', 'product', 'vibe')),
  name TEXT,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  tags TEXT[],
  metadata JSONB, -- 额外元数据 (如模特的种族标签)
  source TEXT DEFAULT 'upload', -- upload/generation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 系统预设素材表
CREATE TABLE presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('model', 'background', 'vibe')),
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  tags TEXT[], -- 如 ['japanese', 'korean', 'chinese', 'western']
  style_category TEXT, -- 日系/韩系/中式/欧美
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 生成历史表
CREATE TABLE generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('camera_product', 'camera_model', 'edit')),
  input_image_url TEXT NOT NULL,
  output_image_urls TEXT[] NOT NULL,
  prompt TEXT,
  params JSONB, -- 存储选择的模特、背景、vibe等参数
  model_version TEXT DEFAULT 'gemini-3-pro-image-preview',
  credits_used INTEGER DEFAULT 1,
  processing_time_ms INTEGER,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 收藏夹表
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_default BOOLEAN DEFAULT FALSE, -- 默认收藏夹
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 收藏关联表
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  image_index INTEGER DEFAULT 0, -- 收藏的是第几张输出图
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, generation_id, image_index)
);

-- 索引优化
CREATE INDEX idx_brand_assets_user ON brand_assets(user_id);
CREATE INDEX idx_brand_assets_type ON brand_assets(type);
CREATE INDEX idx_generations_user ON generations(user_id);
CREATE INDEX idx_generations_created ON generations(created_at DESC);
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_presets_type ON presets(type);
```

---

## 5. API 设计

### 5.1 认证相关

```typescript
// POST /api/auth/login
// POST /api/auth/register  
// POST /api/auth/logout
// GET  /api/auth/session
```

### 5.2 图片生成 API

```typescript
// POST /api/generate/product
// 生成商品图
interface ProductGenerateRequest {
  productImage: string; // base64 或 URL
}

interface ProductGenerateResponse {
  success: boolean;
  images: string[]; // 2张生成图的URL
  generationId: string;
  creditsUsed: number;
}

// POST /api/generate/model
// 生成模特展示图
interface ModelGenerateRequest {
  productImage: string;      // 必须
  modelImage?: string;       // 可选
  modelStyle?: 'japanese' | 'korean' | 'chinese' | 'western' | 'auto';
  backgroundImage?: string;  // 可选
  vibeImage?: string;        // 可选
}

interface ModelGenerateResponse {
  success: boolean;
  images: string[]; // 2张生成图的URL
  generationId: string;
  creditsUsed: number;
}
```

### 5.3 图像编辑 API

```typescript
// POST /api/edit
interface EditRequest {
  inputImage: string;
  modelImage?: string;
  modelStyle?: string;
  backgroundImage?: string;
  vibeImage?: string;
  customPrompt?: string;
}

interface EditResponse {
  success: boolean;
  image: string;
  generationId: string;
  creditsUsed: number;
}
```

### 5.4 资产管理 API

```typescript
// GET    /api/assets/brand?type=model|background|product|vibe
// POST   /api/assets/brand/upload
// DELETE /api/assets/brand/:id
// POST   /api/assets/brand/save-from-generation

// GET    /api/assets/presets?type=model|background|vibe
// GET    /api/assets/presets/models?style=japanese|korean|chinese|western
```

### 5.5 历史与收藏 API

```typescript
// GET    /api/history?page=1&limit=20
// GET    /api/history/:id
// DELETE /api/history/:id

// GET    /api/collections
// POST   /api/collections
// PUT    /api/collections/:id
// DELETE /api/collections/:id

// POST   /api/favorites
// DELETE /api/favorites/:id
// GET    /api/favorites?collectionId=xxx
```

---

## 6. Gemini API 集成

### 6.1 Prompt 模板

```typescript
// prompts/product.ts
export const PRODUCT_PROMPT = `
请把这个商品改成一个专业电商摄影棚拍出来的商品展示图。
要求：
- 专业的摄影棚灯光
- 干净的背景
- 突出商品细节和质感
- 适合社交媒体发布的构图
`;

// prompts/model.ts
export const buildModelPrompt = (params: {
  hasModel: boolean;
  modelStyle?: string;
  hasBackground: boolean;
  hasVibe: boolean;
}) => {
  let prompt = `You are a professional brand photographer, good at shooting social media ready photos for a specific product.

Design a stunning model photo featuring the product shown in the input image.`;

  if (params.hasModel) {
    prompt += `\n\nUse the model shown in the reference model image.`;
  }
  
  if (params.modelStyle && params.modelStyle !== 'auto') {
    const styleMap = {
      japanese: 'Japanese aesthetic with soft, natural lighting and minimalist composition',
      korean: 'Korean K-fashion style with trendy, youthful energy',
      chinese: 'Chinese contemporary style with elegant, sophisticated aesthetics',
      western: 'Western editorial style with bold, fashion-forward approach'
    };
    prompt += `\n\nFollow a ${styleMap[params.modelStyle]}.`;
  }

  if (params.hasBackground) {
    prompt += `\n\nThe background should be consistent with the provided background reference.`;
  }

  if (params.hasVibe) {
    prompt += `\n\nMake the overall vibe consistent with the provided vibe reference.`;
  }

  prompt += `

Additional requirements:
- Make the lighting natural and professional
- The product's color, size, design, and details must be EXACTLY the same as the input
- Create a composition suitable for social media posting
- Ensure the model's pose highlights the product naturally`;

  return prompt;
};
```

### 6.2 API 调用封装

> **参考实现**: [Parallelcamera 项目](https://github.com/superlion8/Parallelcamera)

#### 6.2.1 GenAI 客户端配置

```typescript
/**
 * lib/genai.ts
 * Vertex AI Gemini API 工具函数
 * 使用 @google/genai SDK (API Key + Vertex AI 端点)
 *
 * 环境变量配置：
 * - GEMINI_API_KEY: Google Cloud API Key
 * - GOOGLE_GENAI_USE_VERTEXAI=true: 启用 Vertex AI 端点 (自动设置)
 */
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

// 关键：在模块加载时设置 Vertex AI 模式环境变量
if (!process.env.GOOGLE_GENAI_USE_VERTEXAI) {
  process.env.GOOGLE_GENAI_USE_VERTEXAI = "true";
}

// GenAI 客户端缓存（单例）
let genAIClient: GoogleGenAI | null = null;

// 获取 API Key
function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return apiKey;
}

// 获取 GenAI 客户端（单例）- 使用 Vertex AI 端点
export function getGenAIClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = getApiKey();
    genAIClient = new GoogleGenAI({
      apiKey,
      // Vertex AI 模式通过环境变量 GOOGLE_GENAI_USE_VERTEXAI=true 自动启用
    });
  }
  return genAIClient;
}

// 安全设置配置 - 关闭所有安全过滤以适应服装展示需求
export const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

// Helper: 从响应中提取图片
export function extractImage(response: any): string | null {
  const candidate = response.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") {
    throw new Error("内容被安全过滤阻止，请尝试调整提示词或图片");
  }
  
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if ((part as any).inlineData?.data) {
        return (part as any).inlineData.data;
      }
    }
  }
  return null;
}

export { HarmCategory, HarmBlockThreshold };
```

#### 6.2.2 图片生成函数

```typescript
// lib/generate.ts
import { getGenAIClient, extractImage, safetySettings } from './genai';
import { PRODUCT_PROMPT, buildModelPrompt } from '@/prompts';

const MODEL_NAME = 'gemini-3-pro-image-preview';

// 生成商品展示图
export async function generateProductImages(productImage: string): Promise<string[]> {
  const client = getGenAIClient();
  const results: string[] = [];
  
  // 生成2张图片
  for (let i = 0; i < 2; i++) {
    const parts: any[] = [
      { text: PRODUCT_PROMPT },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: productImage.replace(/^data:image\/\w+;base64,/, ''),
        },
      },
    ];

    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    });

    const generatedImage = extractImage(response);
    if (generatedImage) {
      results.push(`data:image/png;base64,${generatedImage}`);
    }
  }
  
  return results;
}

// 生成模特展示图
export async function generateModelImages(params: {
  productImage: string;
  modelImage?: string;
  modelStyle?: 'japanese' | 'korean' | 'chinese' | 'western' | 'auto';
  backgroundImage?: string;
  vibeImage?: string;
}): Promise<string[]> {
  const client = getGenAIClient();

  const prompt = buildModelPrompt({
    hasModel: !!params.modelImage,
    modelStyle: params.modelStyle,
    hasBackground: !!params.backgroundImage,
    hasVibe: !!params.vibeImage,
  });

  const parts: any[] = [];

  // 如果有模特参考图，先添加（让模型优先识别）
  if (params.modelImage) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: params.modelImage.replace(/^data:image\/\w+;base64,/, ''),
      },
    });
  }

  // 添加 prompt
  parts.push({ text: prompt });

  // 添加商品图（必须）
  parts.push({
    inlineData: {
      mimeType: 'image/jpeg',
      data: params.productImage.replace(/^data:image\/\w+;base64,/, ''),
    },
  });

  // 添加背景参考图
  if (params.backgroundImage) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: params.backgroundImage.replace(/^data:image\/\w+;base64,/, ''),
      },
    });
  }

  // 添加 Vibe 参考图
  if (params.vibeImage) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: params.vibeImage.replace(/^data:image\/\w+;base64,/, ''),
      },
    });
  }

  const results: string[] = [];

  // 生成2张图片
  for (let i = 0; i < 2; i++) {
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    });

    const generatedImage = extractImage(response);
    if (generatedImage) {
      results.push(`data:image/png;base64,${generatedImage}`);
    }
  }

  return results;
}
```

#### 6.2.3 Vercel API Route 示例

```typescript
// api/generate-image.ts (Vercel Serverless Function)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateProductImages, generateModelImages } from '../lib/generate';

export const config = {
  maxDuration: 120, // 最大执行时间 120 秒
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 处理
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, productImage, modelImage, modelStyle, backgroundImage, vibeImage } = req.body;

    let images: string[] = [];

    if (type === 'product') {
      images = await generateProductImages(productImage);
    } else if (type === 'model') {
      images = await generateModelImages({
        productImage,
        modelImage,
        modelStyle,
        backgroundImage,
        vibeImage,
      });
    }

    return res.status(200).json({
      success: true,
      images,
    });
  } catch (error: any) {
    console.error('Error generating image:', error);
    return res.status(500).json({ 
      error: 'Failed to generate image', 
      details: error.message 
    });
  }
}
```

---

## 7. 文件存储结构

### 7.1 Supabase Storage Buckets

```
storage/
├── avatars/              # 用户头像
│   └── {user_id}/
│       └── avatar.jpg
├── brand-assets/         # 品牌资产
│   └── {user_id}/
│       ├── models/
│       ├── backgrounds/
│       ├── products/
│       └── vibes/
├── generations/          # 生成的图片
│   └── {user_id}/
│       └── {generation_id}/
│           ├── input.jpg
│           ├── output_0.jpg
│           ├── output_1.jpg
│           └── ...
├── presets/              # 系统预设素材
│   ├── models/
│   ├── backgrounds/
│   └── vibes/
└── temp/                 # 临时文件（定期清理）
    └── {session_id}/
```

### 7.2 存储策略

```sql
-- RLS 策略
-- 用户只能访问自己的资产
CREATE POLICY "Users can access own assets"
ON storage.objects FOR ALL
USING (
  bucket_id IN ('brand-assets', 'generations', 'avatars')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 所有用户可以读取预设素材
CREATE POLICY "Anyone can read presets"
ON storage.objects FOR SELECT
USING (bucket_id = 'presets');
```

---

## 8. 前端目录结构

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 认证相关页面
│   │   ├── login/
│   │   └── register/
│   ├── (main)/                   # 主应用页面
│   │   ├── camera/               # 相机模块
│   │   │   ├── page.tsx
│   │   │   └── result/
│   │   ├── edit/                 # 图像编辑模块
│   │   │   └── page.tsx
│   │   ├── brand-assets/         # 品牌资产模块
│   │   │   └── page.tsx
│   │   ├── gallery/              # 图片资产模块
│   │   │   └── page.tsx
│   │   └── layout.tsx            # 底部导航布局
│   ├── api/                      # API Routes
│   │   ├── generate/
│   │   ├── edit/
│   │   ├── assets/
│   │   └── auth/
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                       # 基础UI组件
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Sheet.tsx            # 底部抽屉
│   │   ├── Tabs.tsx
│   │   └── ...
│   ├── camera/                   # 相机相关组件
│   │   ├── CameraView.tsx
│   │   ├── UploadButton.tsx
│   │   ├── AssetPicker.tsx      # 素材选择器
│   │   └── StyleSelector.tsx    # 风格选择器
│   ├── editor/                   # 编辑器相关组件
│   │   ├── EditorCanvas.tsx
│   │   └── PromptInput.tsx
│   ├── gallery/                  # 图库相关组件
│   │   ├── ImageGrid.tsx
│   │   ├── ImageDetail.tsx
│   │   └── CollectionCard.tsx
│   └── shared/                   # 共享组件
│       ├── BottomNav.tsx
│       ├── Header.tsx
│       └── LoadingSpinner.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── gemini.ts
│   └── utils.ts
├── hooks/
│   ├── useCamera.ts
│   ├── useAssets.ts
│   ├── useGeneration.ts
│   └── useAuth.ts
├── stores/
│   ├── authStore.ts
│   ├── cameraStore.ts
│   └── assetStore.ts
├── types/
│   └── index.ts
└── prompts/
    ├── product.ts
    └── model.ts
```

---

## 9. 性能优化策略

### 9.1 图片优化

```typescript
// 上传前压缩
import imageCompression from 'browser-image-compression';

const compressImage = async (file: File) => {
  return await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  });
};

// 使用 Next.js Image 组件优化显示
// 配置远程图片域名
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};
```

### 9.2 缓存策略

```typescript
// SWR 配置
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 60000, // 1分钟内相同请求去重
};

// API 缓存头
// 预设素材缓存1天
export async function GET() {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
    },
  });
}
```

### 9.3 生成任务优化

```typescript
// 使用 Vercel Background Functions 处理长时间生成任务
// 前端轮询或 WebSocket 获取结果
export async function POST(request: Request) {
  // 创建任务记录
  const taskId = await createGenerationTask(params);
  
  // 触发后台生成
  await triggerBackgroundGeneration(taskId, params);
  
  // 立即返回任务ID
  return NextResponse.json({ taskId, status: 'processing' });
}

// 后台函数处理实际生成
export async function backgroundGenerate(taskId: string, params: any) {
  const results = await generateWithGemini(params);
  await updateTaskResults(taskId, results);
  // 可选：发送推送通知
}
```

---

## 10. 安全策略

### 10.1 认证与授权

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  const { data: { session } } = await supabase.auth.getSession();
  
  // 保护需要认证的路由
  if (!session && req.nextUrl.pathname.startsWith('/camera')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  return res;
}

export const config = {
  matcher: ['/camera/:path*', '/edit/:path*', '/brand-assets/:path*', '/gallery/:path*'],
};
```

### 10.2 API 安全

```typescript
// Rate Limiting
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 每分钟10次
});

// API Key 保护
// .env.local
GEMINI_API_KEY=xxx  // 服务端环境变量，不暴露给前端
```

### 10.3 输入验证

```typescript
// 使用 Zod 验证所有输入
import { z } from 'zod';

const GenerateSchema = z.object({
  productImage: z.string().min(1),
  modelStyle: z.enum(['japanese', 'korean', 'chinese', 'western', 'auto']).optional(),
  modelImage: z.string().optional(),
  backgroundImage: z.string().optional(),
  vibeImage: z.string().optional(),
});
```

---

## 11. 部署配置

### 11.1 Vercel 配置

```json
// vercel.json
{
  "functions": {
    "app/api/generate/**/*.ts": {
      "maxDuration": 120
    },
    "api/generate-image.ts": {
      "maxDuration": 120
    },
    "app/api/edit/**/*.ts": {
      "maxDuration": 120
    }
  },
  "crons": [
    {
      "path": "/api/cron/cleanup-temp",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### 11.2 环境变量

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Google Gemini (Vertex AI)
# API Key 方式调用 Vertex AI 端点
GEMINI_API_KEY=xxx
# 启用 Vertex AI 模式（自动通过代码设置，无需手动配置）
# GOOGLE_GENAI_USE_VERTEXAI=true

# Optional: Analytics
NEXT_PUBLIC_GA_ID=xxx
SENTRY_DSN=xxx
```

### 11.3 依赖包版本

```json
// package.json 核心依赖
{
  "dependencies": {
    "@google/genai": "^0.7.0",
    "@supabase/supabase-js": "^2.49.8",
    // ... 其他依赖
  }
}
```

---

## 12. 监控与运维

### 12.1 日志记录

```typescript
// 生成请求日志
interface GenerationLog {
  userId: string;
  type: 'product' | 'model' | 'edit';
  inputParams: object;
  processingTime: number;
  status: 'success' | 'error';
  errorMessage?: string;
  creditsUsed: number;
  timestamp: Date;
}
```

### 12.2 指标监控

- 生成成功率
- 平均生成时间
- API 调用量
- 用户活跃度
- Credits 消耗统计

### 12.3 告警配置

- 生成失败率 > 5%
- API 响应时间 > 30s
- 存储使用量 > 80%
- Credits 余额不足

---

## 13. 扩展规划

### 13.1 Phase 2 功能

- [ ] 批量生成
- [ ] 视频生成
- [ ] AI 商品文案生成
- [ ] 多品牌管理
- [ ] 团队协作

### 13.2 技术优化

- [ ] 边缘缓存优化
- [ ] 图片 CDN 加速
- [ ] WebSocket 实时通知
- [ ] 离线 PWA 支持

