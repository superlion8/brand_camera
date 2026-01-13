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
  | 'lifestyle'  // LifeStyle 街拍
  | 'try_on'  // 虚拟换装

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
  photoType?: 'flatlay' | 'hanging'
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
  numImages?: number               // 生成图片数量
  resolution?: string              // 分辨率: standard | hd
  // Group shoot params
  shootMode?: 'random' | 'multiangle'
  styleMode?: 'lifestyle' | 'studio'
  // Outfit/multi-product params
  productImage?: string           // 第一张商品图（向后兼容）
  productImages?: string[]        // 多商品图数组（outfit模式）
  inputImage?: string             // 输入图片 URL
  // Modify material params
  type?: string                   // 任务类型（如 'modify_material', 'lifestyle'）
  targets?: string                // 修改目标描述
  // Lifestyle params
  outfit?: boolean                // 是否为 outfit 模式（多商品搭配）
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

// ============================================
// LifeStyle 模式相关类型
// ============================================

// 上装属性
export interface UpperAttributes {
  category: string
  design_intent: string
  fit: string
  upper_length: string
  neck_collar: string
  sleeve: string
  sleeve_cut: string
  front: string
  hem: string
  material_family: string
  texture: string
  finish: string
  pattern: string
  color_family: string
  color_depth: string
  color_temp: string
  signature_details: string[]
  occlusion: string
}

// 下装属性
export interface LowerAttributes {
  category: string
  design_intent: string
  fit: string
  lower_length: string
  waist_rise: string
  leg_or_skirt_shape: string
  waistband: string
  front_detail: string
  pocket_style: string
  hem_finish: string
  material_family: string
  texture: string
  finish: string
  pattern: string
  color_family: string
  color_depth: string
  color_temp: string
  signature_details: string[]
  occlusion: string
}

// 连体装属性
export interface OnepieceAttributes {
  category: string
  design_intent: string
  fit: string
  onepiece_length: string
  neck_collar: string
  sleeve: string
  sleeve_cut: string
  front: string
  material_family: string
  texture: string
  finish: string
  pattern: string
  color_family: string
  color_depth: string
  color_temp: string
  signature_details: string[]
  occlusion: string
}

// 商品分析结果 (VLM 输出)
export interface ProductTag {
  product_id: string
  outfit_type: 'two_piece' | 'one_piece'
  upper: UpperAttributes | null
  lower: LowerAttributes | null
  onepiece: OnepieceAttributes | null
}

// 场景标签 (lifestyle_scene_tags 表)
export interface LifestyleSceneTag {
  scene_id: string
  schema_version?: string
  outfit_type: string
  lower_category?: string
  upper_category?: string
  onepiece_category?: string
  lower?: string
  onepiece?: string
  upper?: string
  outfit_style_primary?: string
  outfit_style_all?: string
  choose_reason?: string
}

// 模特分析数据 (models_analysis 表)
export interface ModelAnalysis {
  model_id: string
  model_gender?: string
  model_ethnicity?: string
  model_age_group?: string
  model_primary_brand?: string
  model_all_brand?: string[]
  brand_fit_reason?: string
  brand_confidence?: number
  model_style_primary?: string
  model_style_all?: string[]
  style_fit_reason?: string
  style_confidence?: number
  height_range?: string
  body_shape?: string
  shoulder_type?: string
  leg_ratio?: string
  fit_preference?: string
  hair_length?: string
  hair_color?: string
  makeup_intensity?: string
  facial_hair?: string
  expression_intensity?: string
  pose_energy?: string
  best_use_cases?: string[]
  outfit_sweet_spots?: string[]
  model_desc?: string
}

// AI 匹配结果
export interface LifestyleMatchResult {
  model_id_1: string
  model_id_2: string
  model_id_3: string
  model_id_4: string
  scene_id_1: string
  scene_id_2: string
  scene_id_3: string
  scene_id_4: string
}
