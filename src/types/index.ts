export type ModelStyle = 'japanese' | 'korean' | 'chinese' | 'western' | 'auto'

export type ModelGender = 'male' | 'female'

export type AssetType = 'model' | 'background' | 'product' | 'vibe'

export type GenerationType = 'camera_product' | 'camera_model' | 'edit'

export interface Asset {
  id: string
  type: AssetType
  name?: string
  imageUrl: string
  thumbnailUrl?: string
  tags?: string[]
  isSystem?: boolean
  styleCategory?: ModelStyle
}

export interface Generation {
  id: string
  type: GenerationType
  inputImageUrl: string
  outputImageUrls: string[]
  prompt?: string
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
