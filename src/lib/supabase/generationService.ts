/**
 * Generation Service - 后端 API 直接写入数据库
 * 用于在生成 API 中直接保存结果，避免依赖前端写入
 */

import { createClient } from '@/lib/supabase/server'

// Check if string is base64
function isBase64(str: string): boolean {
  if (!str) return false
  return str.startsWith('data:image/') || (str.length > 1000 && /^[A-Za-z0-9+/]+=*$/.test(str.substring(0, 100)))
}

// Upload base64 image to Supabase Storage (server-side)
export async function uploadImageToStorage(
  base64: string, 
  userId: string, 
  prefix: string,
  retries = 3
): Promise<string | null> {
  if (!isBase64(base64)) return base64 // Already a URL
  
  const supabase = await createClient()
  
  // Remove data URL prefix if present
  let base64Content = base64
  let contentType = 'image/png'
  
  if (base64.startsWith('data:')) {
    const match = base64.match(/^data:(image\/\w+);base64,(.+)$/)
    if (match) {
      contentType = match[1]
      base64Content = match[2]
    } else {
      base64Content = base64.replace(/^data:image\/\w+;base64,/, '')
    }
  }
  
  // Convert base64 to buffer (Node.js environment)
  let buffer: Buffer
  try {
    buffer = Buffer.from(base64Content, 'base64')
  } catch (e) {
    console.error('[Storage] Failed to decode base64:', e)
    return null
  }
  
  // Generate unique filename
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = contentType.split('/')[1] || 'png'
  const fileName = `${userId}/${prefix}_${timestamp}_${random}.${extension}`
  
  // Upload with retry
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Storage] Retry ${attempt}/${retries - 1} for ${prefix}...`)
        await new Promise(r => setTimeout(r, 1000 * attempt))
      }
      
      const { data, error } = await supabase.storage
        .from('generations')
        .upload(fileName, buffer, {
          contentType,
          cacheControl: '31536000',
          upsert: false,
        })
      
      if (error) {
        console.error(`[Storage] Upload error (attempt ${attempt + 1}):`, error.message)
        if (attempt === retries - 1) return null
        continue
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('generations')
        .getPublicUrl(data.path)
      
      console.log('[Storage] Uploaded:', prefix, '->', publicUrl.substring(0, 60) + '...')
      return publicUrl
    } catch (error) {
      console.error(`[Storage] Error (attempt ${attempt + 1}):`, error)
      if (attempt === retries - 1) return null
    }
  }
  
  return null
}

/**
 * 后端统一更新任务状态
 * 在所有图片处理完毕后调用，确保 status 正确（不依赖前端）
 * 
 * @param taskId - 任务 ID
 * @param userId - 用户 ID
 * @param successCount - 成功生成的图片数量
 */
export async function finalizeTaskStatus(
  taskId: string,
  userId: string,
  successCount: number
): Promise<void> {
  try {
    const supabase = await createClient()
    const finalStatus = successCount > 0 ? 'completed' : 'failed'
    
    await supabase
      .from('generations')
      .update({ status: finalStatus })
      .eq('user_id', userId)
      .eq('task_id', taskId)
    
    console.log(`[GenService] Updated task ${taskId} status to ${finalStatus} (${successCount} success)`)
  } catch (err) {
    // status 更新失败不影响主流程，前端还会再更新一次
    console.warn(`[GenService] Failed to update task ${taskId} status:`, err)
  }
}

// 追加单张图片到 generation 记录
// 用于 generate-single API，每生成一张图就追加到数据库
// 返回 { success, dbId } 以便前端存储数据库 UUID
export async function appendImageToGeneration(params: {
  taskId: string
  userId: string
  imageIndex: number
  imageUrl: string
  modelType: 'pro' | 'flash'
  genMode: 'simple' | 'extended'
  prompt?: string
  taskType?: string
  inputImageUrl?: string
  inputImage2Url?: string
  inputParams?: Record<string, any>
}): Promise<{ success: boolean; dbId?: string }> {
  const supabase = await createClient()
  
  const { 
    taskId, 
    userId, 
    imageIndex, 
    imageUrl, 
    modelType, 
    genMode, 
    prompt,
    taskType = 'model_studio',
    inputImageUrl,
    inputImage2Url,
    inputParams,
  } = params
  
  console.log(`[GenService] Appending image ${imageIndex} to task ${taskId}`)
  
  // 先查找是否存在该 task_id 的记录
  const { data: existingRecord, error: findError } = await supabase
    .from('generations')
    .select('id, output_image_urls, output_model_types, output_gen_modes, prompts, total_images_count, status')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .single()
  
  if (findError && findError.code !== 'PGRST116') { // PGRST116 = not found
    console.error('[GenService] Find error:', findError)
    return { success: false }
  }
  
  if (existingRecord) {
    // UPDATE: 追加到已存在的记录
    const currentUrls = existingRecord.output_image_urls || []
    const currentModelTypes = existingRecord.output_model_types || []
    const currentGenModes = existingRecord.output_gen_modes || []
    const currentPrompts = existingRecord.prompts || []
    
    // 确保数组长度足够
    while (currentUrls.length <= imageIndex) currentUrls.push(null)
    while (currentModelTypes.length <= imageIndex) currentModelTypes.push(null)
    while (currentGenModes.length <= imageIndex) currentGenModes.push(null)
    while (currentPrompts.length <= imageIndex) currentPrompts.push(null)
    
    // 设置对应位置的值
    currentUrls[imageIndex] = imageUrl
    currentModelTypes[imageIndex] = modelType
    currentGenModes[imageIndex] = genMode
    if (prompt) currentPrompts[imageIndex] = prompt
    
    // 计算实际完成的图片数量
    const completedCount = currentUrls.filter((url: string | null) => url != null).length
    
    const updateData: Record<string, any> = {
      output_image_urls: currentUrls,
      output_model_types: currentModelTypes,
      output_gen_modes: currentGenModes,
      prompts: currentPrompts,
      // 更新统计
      simple_mode_count: currentGenModes.filter((m: string | null) => m === 'simple').length,
      extended_mode_count: currentGenModes.filter((m: string | null) => m === 'extended').length,
    }
    
    // 保存输入参数和图片（只在第一次更新时写入，避免覆盖）
    if (inputParams) {
      updateData.input_params = inputParams
      
      // 从 inputParams 中提取模特和背景图 URL 并单独保存
      const modelUrl = inputParams.perImageModels?.[0]?.imageUrl || inputParams.modelImage
      const bgUrl = inputParams.perImageBackgrounds?.[0]?.imageUrl || inputParams.backgroundImage
      if (modelUrl) {
        updateData.model_image_url = modelUrl
      }
      if (bgUrl) {
        updateData.background_image_url = bgUrl
      }
    }
    if (inputImageUrl) {
      updateData.input_image_url = inputImageUrl
    }
    if (inputImage2Url) {
      updateData.input_image2_url = inputImage2Url
    }
    
    // 如果所有图片都完成了，更新状态为 completed
    // total_images_count 在 quota/reserve 时已设置
    if (existingRecord.total_images_count && completedCount >= existingRecord.total_images_count) {
      updateData.status = 'completed'
      console.log(`[GenService] Task ${taskId} all images completed (${completedCount}/${existingRecord.total_images_count})`)
    }
    
    const { error: updateError } = await supabase
      .from('generations')
      .update(updateData)
      .eq('id', existingRecord.id)
    
    if (updateError) {
      console.error('[GenService] Update error:', updateError)
      return { success: false }
    }
    
    console.log(`[GenService] Updated task ${taskId}, image ${imageIndex} appended, dbId: ${existingRecord.id}`)
    return { success: true, dbId: existingRecord.id }
    
  } else {
    // INSERT: 创建新记录（理论上不应该走到这里，因为 quota/reserve 应该已经创建了）
    console.warn(`[GenService] No existing record for task ${taskId}, creating new one`)
    
    const insertData: Record<string, any> = {
      user_id: userId,
      task_id: taskId,
      task_type: taskType,
      status: 'pending', // 还没完成所有图片
      output_image_urls: Array(imageIndex + 1).fill(null),
      output_model_types: Array(imageIndex + 1).fill(null),
      output_gen_modes: Array(imageIndex + 1).fill(null),
      prompts: Array(imageIndex + 1).fill(null),
      total_images_count: imageIndex + 1,
    }
    
    insertData.output_image_urls[imageIndex] = imageUrl
    insertData.output_model_types[imageIndex] = modelType
    insertData.output_gen_modes[imageIndex] = genMode
    if (prompt) insertData.prompts[imageIndex] = prompt
    
    // 添加输入图片（如果有）
    if (inputImageUrl && !isBase64(inputImageUrl)) {
      insertData.input_image_url = inputImageUrl
    }
    if (inputImage2Url && !isBase64(inputImage2Url)) {
      insertData.input_image2_url = inputImage2Url
    }
    if (inputParams) {
      insertData.input_params = inputParams
      
      // 从 inputParams 中提取模特和背景图 URL 并单独保存
      const modelUrl = inputParams.perImageModels?.[0]?.imageUrl || inputParams.modelImage
      const bgUrl = inputParams.perImageBackgrounds?.[0]?.imageUrl || inputParams.backgroundImage
      if (modelUrl) {
        insertData.model_image_url = modelUrl
      }
      if (bgUrl) {
        insertData.background_image_url = bgUrl
      }
    }
    
    const { data: insertedData, error: insertError } = await supabase
      .from('generations')
      .insert(insertData)
      .select('id')
      .single()
    
    if (insertError) {
      console.error('[GenService] Insert error:', insertError)
      return { success: false }
    }
    
    console.log(`[GenService] Created new task ${taskId} with image ${imageIndex}, dbId: ${insertedData?.id}`)
    return { success: true, dbId: insertedData?.id }
  }
}

// 标记图片生成失败
export async function markImageFailed(params: {
  taskId: string
  userId: string
  imageIndex: number
  error?: string
}): Promise<boolean> {
  const supabase = await createClient()
  
  const { taskId, userId, imageIndex, error: errorMsg } = params
  
  console.log(`[GenService] Marking image ${imageIndex} as failed for task ${taskId}`)
  
  // 查找记录
  const { data: existingRecord, error: findError } = await supabase
    .from('generations')
    .select('id, output_image_urls, total_images_count, status')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .single()
  
  if (findError || !existingRecord) {
    console.warn('[GenService] Record not found for failed image:', taskId)
    return false
  }
  
  const currentUrls = existingRecord.output_image_urls || []
  
  // 确保数组长度足够，标记为 null（失败）
  while (currentUrls.length <= imageIndex) currentUrls.push(null)
  currentUrls[imageIndex] = null // 显式标记为 null
  
  // 计算完成的图片数量（包括失败的）
  // null 表示失败或未完成，非 null 表示成功
  const processedCount = imageIndex + 1 // 当前已处理到的索引
  const successCount = currentUrls.filter((url: string | null) => url != null).length
  
  const updateData: Record<string, any> = {
    output_image_urls: currentUrls,
  }
  
  // 如果所有图片都处理完了（成功或失败），更新状态
  if (existingRecord.total_images_count && processedCount >= existingRecord.total_images_count) {
    if (successCount === 0) {
      updateData.status = 'failed'
      updateData.total_images_count = 0
    } else {
      updateData.status = 'completed'
      updateData.total_images_count = successCount
    }
  }
  
  const { error: updateError } = await supabase
    .from('generations')
    .update(updateData)
    .eq('id', existingRecord.id)
  
  if (updateError) {
    console.error('[GenService] Update error:', updateError)
    return false
  }
  
  return true
}

// 更新 generation 的输入参数（在第一张图开始生成时调用）
export async function updateGenerationInputs(params: {
  taskId: string
  userId: string
  inputImageUrl?: string
  inputImage2Url?: string
  inputParams?: Record<string, any>
}): Promise<boolean> {
  const supabase = await createClient()
  
  const { taskId, userId, inputImageUrl, inputImage2Url, inputParams } = params
  
  const updateData: Record<string, any> = {}
  
  if (inputImageUrl && !isBase64(inputImageUrl)) {
    updateData.input_image_url = inputImageUrl
  }
  if (inputImage2Url && !isBase64(inputImage2Url)) {
    updateData.input_image2_url = inputImage2Url
  }
  if (inputParams) {
    updateData.input_params = inputParams
  }
  
  if (Object.keys(updateData).length === 0) {
    return true // Nothing to update
  }
  
  const { error } = await supabase
    .from('generations')
    .update(updateData)
    .eq('user_id', userId)
    .eq('task_id', taskId)
  
  if (error) {
    console.error('[GenService] Update inputs error:', error)
    return false
  }
  
  return true
}

