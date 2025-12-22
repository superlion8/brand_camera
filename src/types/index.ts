export type ModelStyle = 'korean' | 'western' | 'auto'

export type ModelGender = 'male' | 'female' | 'boy' | 'girl'

export type AssetType = 'model' | 'background' | 'product' | 'vibe'

// 所有可能的生成类型（包含历史变种，保持向后兼容）
// 规范类型定义见 @/lib/taskTypes.ts
// 
// 规范值 → 历史变种:
// - model_studio → camera, camera_model, model
// - product_studio → studio, camera_product, product
// - pro_studio → prostudio
// - group_shoot (无变种)
// - edit → editing
//
// 新代码写入数据库时应使用 TaskTypes 常量
// 判断类型时应使用 isModelType() 等函数（自动兼容历史数据）
export type GenerationType = 
  | 'camera' | 'camera_model' | 'model' | 'model_studio'  // 买家秀
  | 'pro_studio' | 'prostudio'  // 模特棚拍
  | 'group_shoot'  // 组图拍摄
  | 'studio' | 'camera_product' | 'product' | 'product_studio'  // 商品影棚
  | 'edit' | 'editing'  // 通用编辑
  | 'create_model'  // 创建专属模特
  | 'reference_shot'  // 参考图拍摄
  | 'social'  // 社媒种草

export interface Asset {
  id: string
  type: AssetType
  name?: string
  imageUrl: string
  thumbnailUrl?: string
  tags?: string[]
  isSystem?: boolean
  styleCategory?: ModelStyle
  isPinned?: boolean
  category?: string // e.g., 'studio', 'studio-light', 'studio-solid', 'studio-pattern'
}

export interface Generation {
  id: string
  dbId?: string // 数据库 UUID，用于收藏 API（id 可能是 task_id）
  type: GenerationType
  inputImageUrl: string
  inputImage2Url?: string // Second product image
  modelImageUrl?: string // Model image URL from database
  backgroundImageUrl?: string // Background image URL from database
  outputImageUrls: string[]
  outputModelTypes?: ('pro' | 'flash')[] // Model types for each output (Gemini Pro or Flash)
  outputGenModes?: ('simple' | 'extended')[] // Generation modes for each output (极简/扩展)
  prompt?: string // Legacy: combined prompt
  prompts?: string[] // Per-image prompts (index matches outputImageUrls)
  params?: GenerationParams
  createdAt: string
  // IndexedDB references
  inputImageRef?: string
  outputImageRefs?: string[]
}

export interface GenerationParams {
  modelStyle?: ModelStyle
  modelGender?: ModelGender
  modelImage?: string
  backgroundImage?: string
  vibeImage?: string
  // Display names for UI
  model?: string
  background?: string
  vibe?: string
  // Per-image model/background for random selection (indexed by image position)
  perImageModels?: { name: string; imageUrl: string; isRandom?: boolean; isPreset?: boolean }[]
  perImageBackgrounds?: { name: string; imageUrl: string; isRandom?: boolean; isPreset?: boolean }[]
  // Studio params
  photoType?: 'studio' | 'hanging'
  lightType?: string
  lightDirection?: string
  lightColor?: string
  aspectRatio?: string
  // User selection tracking (for model studio)
  modelIsUserSelected?: boolean  // true = user selected, false = system random
  bgIsUserSelected?: boolean     // true = user selected, false = system random
  // Edit params
  customPrompt?: string
  inputImageCount?: number         // 通用编辑输入图片数量
  // Group shoot params
  shootMode?: 'random' | 'multiangle'
  styleMode?: 'lifestyle' | 'studio'
  // Outfit/multi-product params
  productImage?: string           // 第一张商品图（向后兼容）
  productImages?: string[]        // 多商品图数组（outfit模式）
  inputImage?: string             // 输入图片 URL
  // Modify material params
  type?: string                   // 任务类型（如 'modify_material'）
  targets?: string                // 修改目标描述
}

export interface Collection {
  id: string
  name: string
  description?: string
  coverUrl?: string
  isDefault?: boolean
  createdAt: string
}

export interface Favorite {
  id: string
  generationId: string
  collectionId?: string
  imageIndex: number
  createdAt: string
}

// API Types
export interface GenerateProductRequest {
  productImage: string
}

export interface GenerateModelRequest {
  productImage: string
  modelImage?: string
  modelStyle?: ModelStyle
  backgroundImage?: string
  vibeImage?: string
}

export interface GenerateResponse {
  success: boolean
  images: string[]
  error?: string
}

// Store Types
export interface CameraState {
  capturedImage: string | null
  selectedModel: Asset | null
  selectedBackground: Asset | null
  selectedVibe: Asset | null
  modelStyle: ModelStyle
  isGenerating: boolean
  generatedImages: string[]
  setCapturedImage: (image: string | null) => void
  setSelectedModel: (model: Asset | null) => void
  setSelectedBackground: (background: Asset | null) => void
  setSelectedVibe: (vibe: Asset | null) => void
  setModelStyle: (style: ModelStyle) => void
  setIsGenerating: (isGenerating: boolean) => void
  setGeneratedImages: (images: string[]) => void
  reset: () => void
}
