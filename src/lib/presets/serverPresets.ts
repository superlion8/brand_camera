/**
 * 服务端预设资源管理
 * 
 * 功能：
 * 1. 从 Supabase Storage 动态获取预设文件列表
 * 2. 随机选择预设并自动 fallback（如果文件被删除）
 * 3. 将图片 URL 转换为 base64
 */

import { createServiceClient } from '@/lib/supabase/server'

const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets'

// 预设类型
export type PresetType = 
  | 'models'              // 买家秀模特（随机池）
  | 'backgrounds'         // 买家秀背景（随机池）
  | 'studio-models'       // 专业棚拍模特
  | 'studio-backgrounds'  // 专业棚拍背景
  | 'pro-studio'          // 专业棚拍场景（pro_studio_scene_tag 对应）
  | 'all-models'          // 所有模特（models_analysis 对应）
  | 'lifestyle_scene'     // LifeStyle 场景（lifestyle_scene_tags 对应）

// 缓存（服务端短期缓存，避免每次请求都查 Storage）
const listCache = new Map<string, { files: string[], timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 1 分钟缓存

/**
 * 从 Supabase Storage 获取文件列表（带短期缓存）
 */
async function listPresetFiles(folder: PresetType): Promise<string[]> {
  // 检查缓存
  const cached = listCache.get(folder)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.files
  }
  
  try {
    let supabase
    try {
      supabase = createServiceClient()
    } catch (clientError) {
      console.error(`[ServerPresets] Failed to create service client:`, clientError)
      if (cached) return cached.files
      return []
    }
    
    const { data, error } = await supabase.storage
      .from('presets')
      .list(folder, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      })
    
    if (error) {
      console.error(`[ServerPresets] Error listing ${folder}:`, error)
      // 如果有缓存（即使过期），返回缓存
      if (cached) return cached.files
      return []
    }
    
    // 过滤出图片文件
    const files = (data || [])
      .filter(item => {
        if (!item.id || item.id === null) return false
        if (item.name === '.emptyFolderPlaceholder') return false
        return /\.(jpg|jpeg|png|webp|gif)$/i.test(item.name)
      })
      .map(item => item.name)
    
    // 更新缓存
    listCache.set(folder, { files, timestamp: Date.now() })
    console.log(`[ServerPresets] Listed ${folder}: ${files.length} files`)
    
    return files
  } catch (error) {
    console.error(`[ServerPresets] Error:`, error)
    if (cached) return cached.files
    return []
  }
}

/**
 * 获取文件的完整 URL
 */
function getFileUrl(folder: PresetType, fileName: string): string {
  return `${STORAGE_URL}/${folder}/${fileName}`
}

/**
 * 将 URL 转换为 base64（带重试）
 */
async function urlToBase64WithRetry(url: string, maxRetries = 2): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      })
      
      if (!response.ok) {
        console.warn(`[ServerPresets] HTTP ${response.status} for ${url.substring(0, 80)}...`)
        if (attempt === maxRetries) return null
        await new Promise(r => setTimeout(r, 300 * attempt))
        continue
      }
      
      const buffer = Buffer.from(await response.arrayBuffer())
      return buffer.toString('base64')
    } catch (error: any) {
      console.warn(`[ServerPresets] Fetch error (attempt ${attempt}):`, error.message)
      if (attempt === maxRetries) return null
      await new Promise(r => setTimeout(r, 300 * attempt))
    }
  }
  return null
}

/**
 * 获取随机预设图片的 base64 数据（带自动 fallback）
 * 
 * @param folder 预设文件夹
 * @param maxAttempts 最大尝试次数（每次失败会换一个文件重试）
 * @returns { base64: string, fileName: string, url: string } | null
 */
export async function getRandomPresetBase64(
  folder: PresetType,
  maxAttempts = 5
): Promise<{ base64: string; fileName: string; url: string } | null> {
  const files = await listPresetFiles(folder)
  
  if (files.length === 0) {
    console.error(`[ServerPresets] No files found in ${folder}`)
    return null
  }
  
  // 随机排序，然后依次尝试
  const shuffled = [...files].sort(() => Math.random() - 0.5)
  const toTry = shuffled.slice(0, maxAttempts)
  
  for (const fileName of toTry) {
    const url = getFileUrl(folder, fileName)
    console.log(`[ServerPresets] Trying: ${folder}/${fileName}`)
    
    const base64 = await urlToBase64WithRetry(url)
    if (base64) {
      console.log(`[ServerPresets] Success: ${folder}/${fileName}`)
      return { base64, fileName, url }
    }
    
    console.warn(`[ServerPresets] Failed: ${folder}/${fileName}, trying next...`)
    // 从缓存中移除这个失败的文件
    const cached = listCache.get(folder)
    if (cached) {
      cached.files = cached.files.filter(f => f !== fileName)
    }
  }
  
  console.error(`[ServerPresets] All ${maxAttempts} attempts failed for ${folder}`)
  return null
}

/**
 * 获取随机棚拍背景
 */
export async function getRandomStudioBackgroundBase64(
  maxAttempts = 5
): Promise<{ base64: string; fileName: string; url: string; type: string } | null> {
  const result = await getRandomPresetBase64('studio-backgrounds', maxAttempts)
  
  if (result) {
    return { ...result, type: 'studio-backgrounds' }
  }
  
  return null
}

/**
 * 将任意图片输入转换为 base64（支持 URL、base64 字符串、data URL）
 * 如果是随机标记（如 "random" 或 true），返回 null（让调用者使用随机预设）
 */
export async function imageToBase64(
  image: string | boolean | null | undefined
): Promise<string | null> {
  if (!image) return null
  if (image === true || image === 'random') return null
  if (typeof image !== 'string') return null
  
  // 已经是 base64
  if (!image.startsWith('http://') && !image.startsWith('https://')) {
    // 移除 data URL 前缀
    if (image.startsWith('data:')) {
      return image.split(',')[1]
    }
    return image
  }
  
  // 是 URL，转换为 base64
  const base64 = await urlToBase64WithRetry(image)
  return base64
}

/**
 * 清除缓存（可在管理后台删除/添加预设后调用）
 */
export function clearPresetCache(folder?: PresetType) {
  if (folder) {
    listCache.delete(folder)
  } else {
    listCache.clear()
  }
  console.log(`[ServerPresets] Cache cleared: ${folder || 'all'}`)
}

/**
 * 根据文件名获取指定预设图片的 base64 数据
 * 支持自动尝试 .png 和 .jpg 扩展名
 * 
 * @param folder 预设文件夹
 * @param fileNameWithoutExt 文件名（不含扩展名）
 * @returns { base64: string, fileName: string, url: string } | null
 */
export async function getPresetByName(
  folder: string,
  fileNameWithoutExt: string
): Promise<{ base64: string; fileName: string; url: string } | null> {
  const extensions = ['.png', '.jpg', '.jpeg', '.webp']
  
  for (const ext of extensions) {
    const fileName = `${fileNameWithoutExt}${ext}`
    const url = `${STORAGE_URL}/${folder}/${fileName}`
    
    console.log(`[ServerPresets] Trying: ${folder}/${fileName}`)
    
    const base64 = await urlToBase64WithRetry(url, 1)
    if (base64) {
      console.log(`[ServerPresets] Found: ${folder}/${fileName}`)
      return { base64, fileName, url }
    }
  }
  
  console.warn(`[ServerPresets] Not found: ${folder}/${fileNameWithoutExt}`)
  return null
}

