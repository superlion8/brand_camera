export type ModelStyle = 'korean' | 'western' | 'auto'

export type ModelGender = 'male' | 'female' | 'boy' | 'girl'

export type AssetType = 'model' | 'background' | 'product' | 'vibe'

export type GenerationType = 'camera_product' | 'camera_model' | 'edit' | 'studio'

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
}

export interface Generation {
  id: string
  type: GenerationType
  inputImageUrl: string
  inputImage2Url?: string // Second product image
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
  // Studio params
  lightType?: string
  lightDirection?: string
  lightColor?: string
  aspectRatio?: string
  // User selection tracking (for model studio)
  modelIsUserSelected?: boolean  // true = user selected, false = system random
  bgIsUserSelected?: boolean     // true = user selected, false = system random
  // Edit params
  customPrompt?: string
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
