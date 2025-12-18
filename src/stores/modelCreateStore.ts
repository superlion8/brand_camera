import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage } from '@/lib/indexeddb'

// 品牌信息
export interface BrandInfo {
  name: string
  logoUrl?: string // 如果是从 storage 选择的品牌
  isCustom: boolean // 是否是用户输入的自定义品牌
}

// 推荐的模特
export interface RecommendedModel {
  model_id: string
  model_gender: string
  model_age_group: string
  model_style: string
  model_desc: string
  imageUrl: string // 从 storage 获取的图片 URL
}

// 生成的模特图片
export interface GeneratedModelImage {
  id: string
  imageUrl: string
  prompt: string
  isSaved: boolean
}

// 商品描述
export interface ProductDescription {
  index: number
  description: string
}

export interface ModelCreateState {
  // Step 1: 商品图片
  productImages: string[] // 1-4 张商品图
  
  // Step 2: 品牌选择
  selectedBrands: BrandInfo[] // 1-4 个品牌
  
  // Step 3: 分析结果
  brandStyleAnalysis: string // 品牌风格分析
  productDescriptions: ProductDescription[] // 商品描述
  recommendedModels: RecommendedModel[] // 推荐的 20 个模特
  
  // Step 4: 用户选择的模特
  selectedModels: RecommendedModel[] // 用户选择的 1-4 个模特
  
  // Step 5: 生成的模特 prompts
  generatedPrompts: string[]
  
  // Step 6: 生成的模特图片
  generatedImages: GeneratedModelImage[]
  
  // UI 状态
  currentStep: number
  isAnalyzing: boolean
  isGeneratingPrompts: boolean
  isGeneratingImages: boolean
  error: string | null
  
  // Actions
  setProductImages: (images: string[]) => void
  addProductImage: (image: string) => void
  removeProductImage: (index: number) => void
  
  setSelectedBrands: (brands: BrandInfo[]) => void
  addBrand: (brand: BrandInfo) => void
  removeBrand: (index: number) => void
  
  setAnalysisResult: (result: {
    brandStyleAnalysis: string
    productDescriptions: ProductDescription[]
    recommendedModels: RecommendedModel[]
  }) => void
  
  setSelectedModels: (models: RecommendedModel[]) => void
  toggleModelSelection: (model: RecommendedModel) => void
  
  setGeneratedPrompts: (prompts: string[]) => void
  setGeneratedImages: (images: GeneratedModelImage[]) => void
  markImageAsSaved: (imageId: string) => void
  
  setCurrentStep: (step: number) => void
  setIsAnalyzing: (value: boolean) => void
  setIsGeneratingPrompts: (value: boolean) => void
  setIsGeneratingImages: (value: boolean) => void
  setError: (error: string | null) => void
  
  reset: () => void
}

const initialState = {
  productImages: [],
  selectedBrands: [],
  brandStyleAnalysis: '',
  productDescriptions: [],
  recommendedModels: [],
  selectedModels: [],
  generatedPrompts: [],
  generatedImages: [],
  currentStep: 1,
  isAnalyzing: false,
  isGeneratingPrompts: false,
  isGeneratingImages: false,
  error: null,
}

export const useModelCreateStore = create<ModelCreateState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Product Images
      setProductImages: (images) => set({ productImages: images }),
      addProductImage: (image) => {
        const current = get().productImages
        if (current.length < 4) {
          set({ productImages: [...current, image] })
        }
      },
      removeProductImage: (index) => {
        const current = get().productImages
        set({ productImages: current.filter((_, i) => i !== index) })
      },
      
      // Brands
      setSelectedBrands: (brands) => set({ selectedBrands: brands }),
      addBrand: (brand) => {
        const current = get().selectedBrands
        if (current.length < 4) {
          set({ selectedBrands: [...current, brand] })
        }
      },
      removeBrand: (index) => {
        const current = get().selectedBrands
        set({ selectedBrands: current.filter((_, i) => i !== index) })
      },
      
      // Analysis Result
      setAnalysisResult: (result) => set({
        brandStyleAnalysis: result.brandStyleAnalysis,
        productDescriptions: result.productDescriptions,
        recommendedModels: result.recommendedModels,
      }),
      
      // Model Selection
      setSelectedModels: (models) => set({ selectedModels: models }),
      toggleModelSelection: (model) => {
        const current = get().selectedModels
        const exists = current.find(m => m.model_id === model.model_id)
        if (exists) {
          set({ selectedModels: current.filter(m => m.model_id !== model.model_id) })
        } else if (current.length < 4) {
          set({ selectedModels: [...current, model] })
        }
      },
      
      // Generated Content
      setGeneratedPrompts: (prompts) => set({ generatedPrompts: prompts }),
      setGeneratedImages: (images) => set({ generatedImages: images }),
      markImageAsSaved: (imageId) => {
        const current = get().generatedImages
        set({
          generatedImages: current.map(img =>
            img.id === imageId ? { ...img, isSaved: true } : img
          )
        })
      },
      
      // UI State
      setCurrentStep: (step) => set({ currentStep: step }),
      setIsAnalyzing: (value) => set({ isAnalyzing: value }),
      setIsGeneratingPrompts: (value) => set({ isGeneratingPrompts: value }),
      setIsGeneratingImages: (value) => set({ isGeneratingImages: value }),
      setError: (error) => set({ error }),
      
      reset: () => set(initialState),
    }),
    {
      name: 'model-create-storage',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        // 只持久化核心数据，不持久化临时状态
        productImages: state.productImages,
        selectedBrands: state.selectedBrands,
        currentStep: state.currentStep,
      }),
    }
  )
)

