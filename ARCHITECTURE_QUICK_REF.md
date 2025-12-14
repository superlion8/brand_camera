# 品牌相机架构快速参考

> **快速查找文档** - 5分钟了解整个项目架构

---

## 🗺️ 项目地图

```
品牌相机 (Brand Camera)
├─ 📱 前端 (Next.js 14)
│  ├─ 相机模块 → 拍摄/上传商品
│  ├─ 编辑模块 → AI 图片编辑
│  ├─ 资产模块 → 模特/背景素材管理
│  └─ 图库模块 → 生成历史/收藏
│
├─ 🚀 后端 (Vercel Serverless)
│  ├─ /api/generate → 图片生成
│  ├─ /api/quota → 配额管理
│  ├─ /api/gallery → 图库查询
│  └─ /api/admin → 管理后台
│
├─ 🗄️ 数据库 (Supabase)
│  ├─ generations → 生成记录
│  ├─ user_quotas → 用户配额
│  └─ favorites → 收藏记录
│
└─ 🤖 AI (Google Gemini)
   ├─ gemini-3-pro-image-preview (主模型)
   └─ gemini-2.5-flash-image (备用模型)
```

---

## 📂 关键目录结构

```
src/
├── app/                          # Next.js App Router
│   ├── (main)/                   # 主应用
│   │   ├── camera/               # 📷 相机
│   │   ├── edit/                 # ✏️ 编辑
│   │   ├── brand-assets/         # 📁 资产
│   │   └── gallery/              # 🖼️ 图库
│   ├── api/                      # API 路由 (30个)
│   │   ├── generate/             # 🎨 生成
│   │   ├── quota/                # 💰 配额
│   │   └── admin/                # 👑 管理
│   └── auth/                     # 🔐 认证
│
├── components/                   # React 组件 (24个)
│   ├── ui/                       # 基础组件
│   ├── camera/                   # 相机组件
│   └── shared/                   # 共享组件
│
├── lib/                          # 工具库
│   ├── genai.ts                  # ⭐ Gemini API
│   ├── supabase/                 # 数据库
│   └── auth.ts                   # 认证
│
├── stores/                       # 状态管理 (Zustand)
│   ├── cameraStore.ts            # 相机状态
│   ├── assetStore.ts             # 资产状态
│   └── generationTaskStore.ts   # 任务状态
│
└── types/                        # TypeScript 类型
    └── index.ts                  # 类型定义

supabase/
└── migrations/                   # 数据库迁移 (11个)
    ├── 001_create_generations_table.sql
    ├── 004_user_quotas.sql
    └── ...
```

---

## 🔑 核心文件速查

| 文件 | 功能 | 重要度 |
|------|------|--------|
| `src/lib/genai.ts` | Gemini API 封装 | ⭐⭐⭐⭐⭐ |
| `src/app/api/generate/route.ts` | 核心生成逻辑 | ⭐⭐⭐⭐⭐ |
| `src/stores/cameraStore.ts` | 相机状态管理 | ⭐⭐⭐⭐ |
| `src/lib/supabase/generationService.ts` | 数据库服务 | ⭐⭐⭐⭐ |
| `src/types/index.ts` | 类型定义 | ⭐⭐⭐⭐ |
| `src/app/api/quota/route.ts` | 配额系统 | ⭐⭐⭐ |
| `src/components/camera/AssetSelector.tsx` | 资产选择器 | ⭐⭐⭐ |

---

## 🎯 核心功能流程

### 1. 图片生成流程

```
用户拍摄/上传
    ↓
选择参数 (模特/背景/风格)
    ↓
调用 /api/generate
    ↓
┌─────────────────────────────┐
│ 1. 检查配额               │
│ 2. 预留配额               │
│ 3. 生成商品图 (2张)      │
│ 4. 生成指导词 (VLM)      │
│ 5. 生成模特图 (2张)      │
│ 6. 上传 Supabase Storage │
│ 7. 保存数据库记录        │
└─────────────────────────────┘
    ↓
返回结果 (4张图片)
    ↓
显示结果页
```

### 2. 配额系统流程

```
用户请求生成
    ↓
POST /api/quota/reserve
    ↓
┌─────────────────────────────┐
│ 1. 查询用户配额           │
│ 2. 检查是否足够           │
│ 3. 创建预留记录           │
│ 4. 减少可用配额           │
└─────────────────────────────┘
    ↓
返回 taskId
    ↓
开始生成
    ↓
生成完成后
    ↓
自动释放未使用的配额
```

### 3. 认证流程

```
用户访问页面
    ↓
Middleware 检查 Session
    ↓
┌─────────────────────────────┐
│ 未登录 → 重定向到 /login  │
│ 已登录 → 继续访问         │
└─────────────────────────────┘
```

---

## 🗄️ 数据库表速查

### generations (生成记录)
```sql
主要字段:
- id: UUID (主键)
- user_id: UUID (用户ID)
- task_type: 任务类型 (camera/edit/studio...)
- status: 状态 (pending/completed/failed)
- output_image_urls: 输出图片数组
- input_params: 输入参数 (JSONB)
- created_at: 创建时间

索引:
- idx_generations_user_id
- idx_generations_created_at
```

### user_quotas (用户配额)
```sql
主要字段:
- user_id: UUID (主键)
- daily_quota: 每日配额
- monthly_quota: 每月配额
- used_quota_today: 今日已用
- used_quota_month: 本月已用
- quota_reset_at: 配额重置时间

RLS: 用户只能查看自己的配额
```

### favorites (收藏)
```sql
主要字段:
- id: UUID (主键)
- user_id: UUID (用户ID)
- generation_id: UUID (生成记录ID)
- image_index: 图片索引 (第几张)
- created_at: 创建时间

唯一约束: (user_id, generation_id, image_index)
```

---

## 🔌 API 端点速查

### 生成相关
```
POST /api/generate                  # 统一生成入口 (4张图)
POST /api/generate-product         # 商品图生成 (2张)
POST /api/generate-model           # 模特图生成 (2张)
POST /api/generate-single          # 单张生成 (逐张)
POST /api/generate-studio          # 商品影棚
POST /api/generate-pro-studio      # 模特棚拍
POST /api/generate-group           # 组图拍摄
POST /api/edit                     # 图片编辑
POST /api/modify-material          # 材质修改
```

### 配额相关
```
GET  /api/quota                    # 查询配额
POST /api/quota/reserve            # 预留配额
GET  /api/quota-applications       # 配额申请列表
POST /api/quota-applications       # 提交配额申请
```

### 图库相关
```
GET  /api/gallery                  # 生成历史
GET  /api/generations/:id          # 单条记录详情
POST /api/favorites                # 添加收藏
DELETE /api/favorites/:id          # 取消收藏
```

### 资产相关
```
GET  /api/presets/list             # 预设素材列表
```

### 管理相关
```
GET  /api/admin/stats              # 统计数据
GET  /api/admin/downloads          # 下载记录
GET  /api/admin/quotas             # 配额管理
GET  /api/admin/quota-applications # 申请审核
POST /api/admin/presets            # 素材管理
```

---

## 🎨 状态管理速查

### cameraStore (相机状态)
```typescript
{
  capturedImage: string | null,        // 拍摄的图片
  selectedModel: Asset | null,         // 选中的模特
  selectedBackground: Asset | null,    // 选中的背景
  selectedVibe: Asset | null,          // 选中的 Vibe
  modelStyle: ModelStyle,              // 模特风格
  isGenerating: boolean,               // 是否生成中
  generatedImages: string[],           // 生成的图片
}

// 持久化到 IndexedDB
// 仅持久化选择状态，不持久化图片
```

### assetStore (资产状态)
```typescript
{
  models: Asset[],                     // 模特列表
  backgrounds: Asset[],                // 背景列表
  vibes: Asset[],                      // Vibe 列表
  isLoading: boolean,                  // 加载状态
}
```

### generationTaskStore (生成任务)
```typescript
{
  tasks: Map<string, Task>,            // 任务列表
  currentTaskId: string | null,        // 当前任务
}
```

---

## 🔐 环境变量速查

### 必需变量
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Google Gemini
GEMINI_API_KEY=xxx                     # ⭐ 最重要
```

### 可选变量
```bash
# 管理员邮箱
ADMIN_EMAILS=admin@example.com
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com

# 阿里云短信 (手机号登录)
ALIYUN_ACCESS_KEY_ID=xxx
ALIYUN_ACCESS_KEY_SECRET=xxx
ALIYUN_SMS_SIGN_NAME=品牌相机
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxx
SMS_SECRET_SALT=xxx
```

---

## 🚀 快速开发指南

### 1. 启动开发环境
```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入 GEMINI_API_KEY 等

# 启动开发服务器
pnpm dev

# 访问 http://localhost:3000
```

### 2. 添加新功能
```bash
# 1. 创建 API 路由
src/app/api/your-feature/route.ts

# 2. 添加类型定义
src/types/index.ts

# 3. 创建状态管理
src/stores/yourFeatureStore.ts

# 4. 创建组件
src/components/your-feature/YourComponent.tsx

# 5. 创建页面
src/app/(main)/your-feature/page.tsx
```

### 3. 数据库迁移
```bash
# 创建新迁移文件
supabase/migrations/00X_your_migration.sql

# 示例：添加新表
CREATE TABLE your_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

# 添加 RLS 策略
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own data"
  ON your_table FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 🐛 常见问题速查

### Q1: GEMINI_API_KEY 无效
```bash
检查：
1. API Key 是否正确
2. 是否启用了 Vertex AI API
3. 环境变量是否正确配置

解决：
- 检查 Google Cloud Console
- 确认 GOOGLE_GENAI_USE_VERTEXAI=true 被自动设置
- 查看服务端日志
```

### Q2: 生成失败 429 错误
```bash
原因：速率限制

解决：
1. 增加 BATCH_DELAY_MS (默认 1500ms)
2. 使用 Flash 模型降级
3. 等待一段时间后重试

代码位置：src/app/api/generate/route.ts
```

### Q3: Supabase 连接失败
```bash
检查：
1. NEXT_PUBLIC_SUPABASE_URL 是否正确
2. SUPABASE_ANON_KEY 是否正确
3. RLS 策略是否配置

解决：
- 检查 Supabase Dashboard
- 确认 RLS 策略启用
- 查看浏览器控制台错误
```

### Q4: 图片上传失败
```bash
检查：
1. Storage Bucket 是否创建
2. RLS 策略是否正确
3. 文件大小是否超限

解决：
- 检查 Supabase Storage 配置
- 确认 bucket 为 'generations'
- 查看上传日志
```

---

## 📊 性能优化速查

### API 响应时间
```
目标值：
- 预设列表: < 500ms
- 配额查询: < 200ms
- 图库查询: < 1s
- 图片生成: < 120s

优化方向：
1. 添加响应缓存
2. 优化数据库查询
3. 使用 CDN
4. 串行改并行（在允许的情况下）
```

### 数据库查询
```sql
-- 优化前
SELECT * FROM generations WHERE user_id = $1

-- 优化后
SELECT id, created_at, task_type, status 
FROM generations 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 20 OFFSET 0
```

### 图片加载
```typescript
// 使用 Next.js Image 组件
import Image from 'next/image'

<Image
  src={imageUrl}
  alt="Generated"
  width={500}
  height={500}
  loading="lazy"
  placeholder="blur"
/>
```

---

## 🔍 调试技巧

### 1. API 调试
```typescript
// 查看 API 日志
// Vercel Dashboard → Functions → Logs

// 本地调试
console.log('[Label] Message', data)

// 示例
console.log('[Generate] Starting generation...')
console.log('[Generate] Product image length:', productImageData.length)
```

### 2. 状态调试
```typescript
// Zustand Devtools
import { devtools } from 'zustand/middleware'

export const useCameraStore = create<CameraState>()(
  devtools(
    persist(/* ... */)
  )
)

// Chrome 扩展：Redux DevTools
```

### 3. 网络调试
```bash
# 浏览器开发者工具
Network → XHR → 查看 API 请求/响应

# 查看请求头
Authorization: Bearer xxx

# 查看响应
{ success: true, images: [...] }
```

---

## 📖 相关文档

- 详细架构分析: [ARCHITECTURE_ANALYSIS.md](ARCHITECTURE_ANALYSIS.md)
- 技术架构文档: [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)
- UI/UX 设计规范: [UIUX_DESIGN_SPEC.md](UIUX_DESIGN_SPEC.md)
- README: [README.md](README.md)

---

## 🎯 快速命令

```bash
# 开发
pnpm dev                           # 启动开发服务器
pnpm build                         # 构建生产版本
pnpm start                         # 启动生产服务器

# 代码检查
pnpm lint                          # 运行 ESLint
pnpm type-check                    # TypeScript 类型检查

# 数据库
pnpm upload-presets                # 上传预设素材
```

---

*快速参考文档 | 最后更新: 2025-12-14*
