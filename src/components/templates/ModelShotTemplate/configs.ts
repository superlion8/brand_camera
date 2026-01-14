import { ModelShotConfig } from "./types"

/** Pro Studio page configuration */
export const proStudioConfig: ModelShotConfig = {
  pageId: 'pro-studio',
  pageTitleKey: 'proStudio.title',
  apiEndpoint: '/api/generate-pro-studio',
  taskType: 'pro_studio',
  storageKey: 'proStudioTaskId',
  logPrefix: '[ProStudio]',
  numImages: 4,
  creditCost: 4,
  additionalProductMode: 'single',
  maxAdditionalProducts: 1,
  presetType: 'studio',
  showAnalyzeProduct: true,
  imageLabels: [
    { zh: '图片 1', en: 'Image 1', color: 'bg-blue-500' },
    { zh: '图片 2', en: 'Image 2', color: 'bg-purple-500' },
    { zh: '图片 3', en: 'Image 3', color: 'bg-amber-500' },
    { zh: '图片 4', en: 'Image 4', color: 'bg-green-500' },
  ],
}

/** Lifestyle page configuration */
export const lifestyleConfig: ModelShotConfig = {
  pageId: 'lifestyle',
  pageTitleKey: 'lifestyle.title',
  apiEndpoint: '/api/generate-lifestyle',
  taskType: 'lifestyle',
  storageKey: 'lifestyleTaskId',
  logPrefix: '[Lifestyle]',
  numImages: 4,
  creditCost: 4,
  additionalProductMode: 'single',
  maxAdditionalProducts: 1,
  presetType: 'lifestyle',
  imageLabels: [
    { zh: '场景 1', en: 'Scene 1', color: 'bg-emerald-500' },
    { zh: '场景 2', en: 'Scene 2', color: 'bg-sky-500' },
    { zh: '场景 3', en: 'Scene 3', color: 'bg-violet-500' },
    { zh: '场景 4', en: 'Scene 4', color: 'bg-rose-500' },
  ],
}

/** Buyer Show page configuration */
export const buyerShowConfig: ModelShotConfig = {
  pageId: 'buyer-show',
  pageTitleKey: 'camera.title',
  apiEndpoint: '/api/generate-single',
  taskType: 'buyer_show',
  storageKey: 'buyerShowTaskId',
  logPrefix: '[BuyerShow]',
  numImages: 4,
  creditCost: 4,
  additionalProductMode: 'array',
  maxAdditionalProducts: 3, // Main + 3 = 4 total
  presetType: 'standard',
  showGenderSelector: true,
  imageLabels: [
    { zh: '标准 1', en: 'Simple 1', color: 'bg-blue-500' },
    { zh: '标准 2', en: 'Simple 2', color: 'bg-purple-500' },
    { zh: '扩展 1', en: 'Extended 1', color: 'bg-amber-500' },
    { zh: '扩展 2', en: 'Extended 2', color: 'bg-green-500' },
  ],
}

/** Social UGC page configuration */
export const socialConfig: ModelShotConfig = {
  pageId: 'social',
  pageTitleKey: 'social.title',
  apiEndpoint: '/api/generate-social',
  taskType: 'social',
  storageKey: 'socialTaskId',
  logPrefix: '[Social]',
  numImages: 4,
  creditCost: 4,
  additionalProductMode: 'array',
  maxAdditionalProducts: 3, // Main + 3 = 4 total
  presetType: 'standard',
  showGroupLabels: true,
  groupLabels: ['A', 'B'],
  imageLabels: [
    { zh: 'A-1', en: 'A-1', color: 'bg-blue-500' },
    { zh: 'A-2', en: 'A-2', color: 'bg-blue-400' },
    { zh: 'B-1', en: 'B-1', color: 'bg-purple-500' },
    { zh: 'B-2', en: 'B-2', color: 'bg-purple-400' },
  ],
}

/** Get config by page ID */
export function getModelShotConfig(pageId: ModelShotConfig['pageId']): ModelShotConfig {
  switch (pageId) {
    case 'pro-studio': return proStudioConfig
    case 'lifestyle': return lifestyleConfig
    case 'buyer-show': return buyerShowConfig
    case 'social': return socialConfig
    default: throw new Error(`Unknown page ID: ${pageId}`)
  }
}

/** All configs for reference */
export const allConfigs = {
  'pro-studio': proStudioConfig,
  'lifestyle': lifestyleConfig,
  'buyer-show': buyerShowConfig,
  'social': socialConfig,
}
