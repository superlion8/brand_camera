import { Asset, ModelGender } from "@/types"
import { ReactNode } from "react"

export type PageMode = "camera" | "review" | "processing" | "results"

/** Configuration for different Model Shot pages */
export interface ModelShotConfig {
  /** Unique page identifier */
  pageId: 'pro-studio' | 'lifestyle' | 'buyer-show' | 'social'
  
  /** Page title key in translations */
  pageTitleKey: string
  
  /** API endpoint for generation */
  apiEndpoint: string
  
  /** Task type for quota/billing */
  taskType: string
  
  /** Session storage key for task recovery */
  storageKey: string
  
  /** Log prefix for debugging */
  logPrefix: string
  
  /** Number of images to generate */
  numImages: number
  
  /** Credit cost per generation */
  creditCost: number
  
  /** 
   * Additional product mode:
   * - 'single': Only one additional product (capturedImage2)
   * - 'array': Multiple additional products (up to maxAdditionalProducts)
   */
  additionalProductMode: 'single' | 'array'
  
  /** Max additional products allowed (only for 'array' mode) */
  maxAdditionalProducts: number
  
  /**
   * Preset type determines which presets to show:
   * - 'studio': studioModels, studioBackgrounds (Pro Studio)
   * - 'lifestyle': lifestyleModels, lifestyleScenes (Lifestyle)
   * - 'standard': visibleModels, visibleBackgrounds (Buyer Show, Social)
   */
  presetType: 'studio' | 'lifestyle' | 'standard'
  
  /** Show gender selector (Buyer Show only) */
  showGenderSelector?: boolean
  
  /** Show group labels for results (Social only) */
  showGroupLabels?: boolean
  
  /** Group labels (Social only) */
  groupLabels?: string[]
  
  /** Image labels with colors */
  imageLabels?: { zh: string; en: string; color: string }[]
  
  /** Whether to show analyze product feature (Pro Studio) */
  showAnalyzeProduct?: boolean
  
  /** Custom header right content */
  headerRightContent?: ReactNode
}

/** API request parameters */
export interface ApiRequestParams {
  productImage: string
  additionalProducts?: string[]
  modelImage?: string
  backgroundImage?: string
  modelGender?: ModelGender
  taskId: string
  language?: string
  // Pro Studio specific
  productImages?: { imageUrl: string }[]
  outfitItems?: any[]
}

/** Result badge configuration */
export interface ResultBadge {
  label: string
  color: string
  groupLabel?: string
}

/** State shared across all Model Shot pages */
export interface ModelShotState {
  mode: PageMode
  capturedImage: string | null
  additionalProducts: string[] // Works for both single and array mode
  selectedModelId: string | null
  selectedBgId: string | null
  selectedModelGender: ModelGender | null
  generatedImages: string[]
  generatedModelTypes: string[]
  generatedGenModes: string[]
  generatedPrompts: string[]
  currentTaskId: string | null
  currentGenerationId: string | null
  isProcessing: boolean
  error: string | null
}

/** Actions to update Model Shot state */
export interface ModelShotActions {
  setMode: (mode: PageMode) => void
  setCapturedImage: (image: string | null) => void
  addAdditionalProduct: (image: string) => void
  removeAdditionalProduct: (index: number) => void
  clearAdditionalProducts: () => void
  setSelectedModelId: (id: string | null) => void
  setSelectedBgId: (id: string | null) => void
  setSelectedModelGender: (gender: ModelGender | null) => void
  setGeneratedImages: (images: string[]) => void
  setCurrentTaskId: (id: string | null) => void
  setCurrentGenerationId: (id: string | null) => void
  startGeneration: () => Promise<void>
  regenerate: () => void
  reset: () => void
}

/** Props for custom sections */
export interface CustomSectionProps {
  config: ModelShotConfig
  state: ModelShotState
  actions: ModelShotActions
  isDesktop: boolean
  t: any
}

/** Asset combination for model/background selection */
export interface CombinedAssets {
  models: Asset[]
  backgrounds: Asset[]
  customModels: Asset[]
  customBackgrounds: Asset[]
}
