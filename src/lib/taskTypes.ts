/**
 * 任务类型标准化模块
 * 
 * 解决问题：历史代码中存在多种任务类型表示（如 camera/camera_model/model/model_studio）
 * 解决方案：定义规范类型 + 映射表，统一管理所有变种
 * 
 * 使用方式：
 * - 新代码写入数据库时使用 TaskTypes.XXX 常量
 * - 判断类型时使用 isModelType() 等函数（自动兼容历史数据）
 */

// ===== 规范任务类型常量 =====
// 新代码只使用这些值写入数据库
export const TaskTypes = {
  MODEL_STUDIO: 'model_studio',      // 买家秀 (legacy)
  BUYER_SHOW: 'buyer_show',          // Buyer Show
  PRODUCT_STUDIO: 'product_studio',  // 商品影棚
  PRODUCT_SHOT: 'product_shot',      // Product Shot
  PRO_STUDIO: 'pro_studio',          // Model Studio (专业棚拍)
  GROUP_SHOOT: 'group_shoot',        // Group Shoot
  EDIT: 'edit',                      // 通用编辑
  CREATE_MODEL: 'create_model',      // 创建专属模特
  REFERENCE_SHOT: 'reference_shot',  // Reference Shot
  LIFESTYLE: 'lifestyle',            // LifeStyle Shot
  TRY_ON: 'try_on',                  // Outfit Change (虚拟换装)
  BRAND_STYLE: 'brand_style',        // Clone Brand Style
  SOCIAL: 'social',                  // Social UGC
} as const

// ===== Credit 消耗配置（单一数据源） =====
// 所有页面的 checkQuota 和 CreditCostBadge 都应使用这些值
export const TASK_CREDIT_COSTS: Record<string, number> = {
  // Model Shot - 4 images each
  [TaskTypes.PRO_STUDIO]: 4,
  [TaskTypes.LIFESTYLE]: 4,
  [TaskTypes.BUYER_SHOW]: 4,
  [TaskTypes.MODEL_STUDIO]: 4,
  [TaskTypes.SOCIAL]: 4,
  
  // Custom Shot - 2 images each
  [TaskTypes.GROUP_SHOOT]: 4,        // 动态: numImages, 默认4
  [TaskTypes.REFERENCE_SHOT]: 2,
  [TaskTypes.PRODUCT_SHOT]: 2,
  [TaskTypes.PRODUCT_STUDIO]: 2,
  [TaskTypes.TRY_ON]: 2,             // Outfit Change
  
  // Single image
  [TaskTypes.EDIT]: 1,

  // Create Model - 2 images
  [TaskTypes.CREATE_MODEL]: 2,

  // Special: Brand Style (4 images + 1 video = 4 + 10 = 14)
  [TaskTypes.BRAND_STYLE]: 14,
}

/**
 * 获取任务类型的 credit 消耗
 * @param taskType 任务类型
 * @returns credit 数量，默认返回 1
 */
export function getTaskCreditCost(taskType: string): number {
  return TASK_CREDIT_COSTS[taskType] ?? 1
}

export type CanonicalTaskType = typeof TaskTypes[keyof typeof TaskTypes]

// ===== 类型映射表（单一数据源） =====
// 将所有历史变种映射到规范类型
const TYPE_MAP: Record<string, CanonicalTaskType> = {
  // 买家秀 → model_studio (legacy) / buyer_show
  'camera': TaskTypes.MODEL_STUDIO,
  'camera_model': TaskTypes.MODEL_STUDIO,
  'model': TaskTypes.MODEL_STUDIO,
  'model_studio': TaskTypes.MODEL_STUDIO,
  'buyer_show': TaskTypes.BUYER_SHOW,
  'buyershow': TaskTypes.BUYER_SHOW,
  
  // 商品影棚 → product_studio / product_shot
  'studio': TaskTypes.PRODUCT_STUDIO,
  'camera_product': TaskTypes.PRODUCT_STUDIO,
  'product': TaskTypes.PRODUCT_STUDIO,
  'product_studio': TaskTypes.PRODUCT_STUDIO,
  'product_shot': TaskTypes.PRODUCT_SHOT,
  'productshot': TaskTypes.PRODUCT_SHOT,
  
  // Model Studio (专业棚拍) → pro_studio
  'pro_studio': TaskTypes.PRO_STUDIO,
  'prostudio': TaskTypes.PRO_STUDIO,
  
  // 组图拍摄 → group_shoot
  'group_shoot': TaskTypes.GROUP_SHOOT,
  'groupshot': TaskTypes.GROUP_SHOOT,
  
  // 通用编辑 → edit
  'edit': TaskTypes.EDIT,
  'editing': TaskTypes.EDIT,
  
  // 创建专属模特 → create_model
  'create_model': TaskTypes.CREATE_MODEL,
  
  // Reference Shot → reference_shot
  'reference_shot': TaskTypes.REFERENCE_SHOT,
  'referenceshot': TaskTypes.REFERENCE_SHOT,
  
  // LifeStyle Shot → lifestyle
  'lifestyle': TaskTypes.LIFESTYLE,
  
  // Outfit Change (虚拟换装) → try_on
  'try_on': TaskTypes.TRY_ON,
  'tryon': TaskTypes.TRY_ON,
  'outfit_change': TaskTypes.TRY_ON,
  
  // Clone Brand Style → brand_style
  'brand_style': TaskTypes.BRAND_STYLE,
  'brandstyle': TaskTypes.BRAND_STYLE,
  'brand': TaskTypes.BRAND_STYLE,
  
  // Social UGC → social
  'social': TaskTypes.SOCIAL,
  'social_ugc': TaskTypes.SOCIAL,
}

// ===== 核心函数 =====

/**
 * 获取规范任务类型
 * @param type 任意历史类型值
 * @returns 规范类型，未知类型返回 null
 */
export function getCanonicalType(type?: string): CanonicalTaskType | null {
  if (!type) return null
  return TYPE_MAP[type.toLowerCase()] || null
}

/**
 * 判断是否是买家秀类型
 * 包含: camera, camera_model, model, model_studio
 */
export function isModelType(type?: string): boolean {
  return getCanonicalType(type) === TaskTypes.MODEL_STUDIO
}

/**
 * 判断是否是商品影棚类型
 * 包含: studio, camera_product, product, product_studio
 */
export function isProductType(type?: string): boolean {
  return getCanonicalType(type) === TaskTypes.PRODUCT_STUDIO
}

/**
 * 判断是否是专业棚拍类型
 * 包含: pro_studio, prostudio
 */
export function isProStudioType(type?: string): boolean {
  return getCanonicalType(type) === TaskTypes.PRO_STUDIO
}

/**
 * 判断是否是组图拍摄类型
 * 包含: group_shoot
 */
export function isGroupShootType(type?: string): boolean {
  return getCanonicalType(type) === TaskTypes.GROUP_SHOOT
}

/**
 * 判断是否是通用编辑类型
 * 包含: edit, editing
 */
export function isEditType(type?: string): boolean {
  return getCanonicalType(type) === TaskTypes.EDIT
}

/**
 * 判断是否是创建专属模特类型
 * 包含: create_model
 */
export function isCreateModelType(type?: string): boolean {
  return getCanonicalType(type) === TaskTypes.CREATE_MODEL
}

/**
 * 判断是否是参考图拍摄类型
 * 包含: reference_shot
 */
export function isReferenceShotType(type?: string): boolean {
  return getCanonicalType(type) === TaskTypes.REFERENCE_SHOT
}

/**
 * 判断是否是 LifeStyle 街拍类型
 * 包含: lifestyle
 */
export function isLifestyleType(type?: string): boolean {
  return getCanonicalType(type) === TaskTypes.LIFESTYLE
}

/**
 * 判断是否是虚拟换装类型
 * 包含: try_on, tryon
 */
export function isTryOnType(type?: string): boolean {
  return getCanonicalType(type) === TaskTypes.TRY_ON
}

/**
 * 判断是否是 Clone Brand Style 类型
 * 包含: brand_style, brandstyle, brand
 */
export function isBrandStyleType(type?: string): boolean {
  return getCanonicalType(type) === TaskTypes.BRAND_STYLE
}

/**
 * 判断是否是模特相关类型（买家秀 + 专业棚拍 + 组图 + 创建专属模特 + 参考图拍摄）
 * 用于图库的"模特"分类筛选
 */
export function isModelRelatedType(type?: string): boolean {
  const canonical = getCanonicalType(type)
  return canonical === TaskTypes.MODEL_STUDIO || 
         canonical === TaskTypes.PRO_STUDIO || 
         canonical === TaskTypes.GROUP_SHOOT ||
         canonical === TaskTypes.CREATE_MODEL ||
         canonical === TaskTypes.REFERENCE_SHOT ||
         canonical === TaskTypes.LIFESTYLE
}

/**
 * 获取类型的中文显示名称
 */
export function getTypeDisplayName(type?: string): string {
  const canonical = getCanonicalType(type)
  switch (canonical) {
    case TaskTypes.MODEL_STUDIO: return '买家秀'
    case TaskTypes.PRODUCT_STUDIO: return '商品影棚'
    case TaskTypes.PRO_STUDIO: return '专业棚拍'
    case TaskTypes.GROUP_SHOOT: return '组图拍摄'
    case TaskTypes.EDIT: return '通用编辑'
    case TaskTypes.CREATE_MODEL: return '创建专属模特'
    case TaskTypes.REFERENCE_SHOT: return '参考图拍摄'
    case TaskTypes.LIFESTYLE: return 'LifeStyle 街拍'
    case TaskTypes.TRY_ON: return '虚拟换装'
    case TaskTypes.BRAND_STYLE: return 'Clone Brand Style'
    default: return '未知类型'
  }
}

