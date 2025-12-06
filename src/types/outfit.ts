// 商品类型定义
export type ProductCategory = "内衬" | "上衣" | "裤子" | "帽子" | "鞋子" | "配饰"
export const VALID_CATEGORIES: ProductCategory[] = ["内衬", "上衣", "裤子", "帽子", "鞋子", "配饰"]

// 分析结果类型
export interface ProductAnalysis {
  type: ProductCategory
  material: string
  fit: string
  imageUrl: string
}

// 搭配项目
export interface OutfitItem {
  imageUrl: string
  material?: string
  fit?: string
}

