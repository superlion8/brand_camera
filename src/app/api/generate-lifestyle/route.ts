import { NextRequest } from 'next/server'
import { getGenAIClient, extractImage, extractText, safetySettings } from '@/lib/genai'
import { createClient } from '@/lib/supabase/server'
import { appendImageToGeneration, uploadImageToStorage } from '@/lib/supabase/generationService'
import { imageToBase64, getPresetByName } from '@/lib/presets/serverPresets'
import { LIFESTYLE_VLM_PROMPT, buildLifestyleMatchPrompt, LIFESTYLE_FINAL_PROMPT } from '@/prompts/lifestyle'
import type { ProductTag, LifestyleSceneTag, ModelAnalysis, LifestyleMatchResult } from '@/types'

export const maxDuration = 300 // 5 minutes

// Model names
const VLM_MODEL = 'gemini-3-flash-preview'
const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_IMAGE_MODEL = 'gemini-2.5-flash-image'

// Storage base URLs
const ALL_MODELS_STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/all_models'
const LIFESTYLE_SCENE_STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/lifestyle_scene'

// Number of images to generate
const NUM_IMAGES = 4

// Helper to ensure base64 data
async function ensureBase64Data(image: string | null | undefined): Promise<string | null> {
  if (!image) return null
  return await imageToBase64(image)
}

// Helper to fetch image as base64 from URL
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    return buffer.toString('base64')
  } catch (error) {
    console.error('[Lifestyle] Failed to fetch image:', url, error)
    return null
  }
}

// Step 1: Analyze product with VLM
async function analyzeProduct(
  client: ReturnType<typeof getGenAIClient>,
  productImageData: string
): Promise<ProductTag | null> {
  try {
    console.log('[Lifestyle] Step 1: Analyzing product...')
    
    const response = await client.models.generateContent({
      model: VLM_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: LIFESTYLE_VLM_PROMPT },
          { inlineData: { mimeType: 'image/jpeg', data: productImageData } },
        ],
      }],
      config: { safetySettings },
    })
    
    const text = extractText(response)
    if (!text) {
      console.error('[Lifestyle] VLM returned empty response')
      return null
    }
    
    // Parse JSON response
    let jsonText = text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }
    
    const productTag = JSON.parse(jsonText) as ProductTag
    console.log('[Lifestyle] Product analysis complete:', productTag.outfit_type)
    
    return productTag
  } catch (error: any) {
    console.error('[Lifestyle] Product analysis failed:', error.message)
    return null
  }
}

// Step 2: Filter scenes by product tag
async function filterScenesByTag(
  supabase: any,
  productTag: ProductTag
): Promise<string[]> {
  try {
    console.log('[Lifestyle] Step 2: Filtering scenes...')
    
    const { outfit_type } = productTag
    const upperCat = productTag.upper?.category
    const lowerCat = productTag.lower?.category
    const onepieceCat = productTag.onepiece?.category
    
    // For two_piece: try to match both upper and lower, fallback to upper only
    if (outfit_type === 'two_piece' && upperCat && lowerCat) {
      // Try full match first
      const { data: fullMatch } = await supabase
        .from('lifestyle_scene_tags')
        .select('scene_id')
        .eq('outfit_type', outfit_type)
        .eq('upper_category', upperCat)
        .eq('lower_category', lowerCat)
      
      if (fullMatch && fullMatch.length > 0) {
        console.log('[Lifestyle] Full match found:', fullMatch.length, 'scenes')
        return fullMatch.map((r: any) => r.scene_id)
      }
      
      // Fallback: upper only
      const { data: upperMatch } = await supabase
        .from('lifestyle_scene_tags')
        .select('scene_id')
        .eq('outfit_type', outfit_type)
        .eq('upper_category', upperCat)
      
      if (upperMatch && upperMatch.length > 0) {
        console.log('[Lifestyle] Upper match found:', upperMatch.length, 'scenes')
        return upperMatch.map((r: any) => r.scene_id)
      }
    }
    
    // For one_piece: match onepiece_category
    if (outfit_type === 'one_piece' && onepieceCat) {
      const { data: onepieceMatch } = await supabase
        .from('lifestyle_scene_tags')
        .select('scene_id')
        .eq('outfit_type', outfit_type)
        .eq('onepiece_category', onepieceCat)
      
      if (onepieceMatch && onepieceMatch.length > 0) {
        console.log('[Lifestyle] Onepiece match found:', onepieceMatch.length, 'scenes')
        return onepieceMatch.map((r: any) => r.scene_id)
      }
    }
    
    // Final fallback: all scenes with matching outfit_type
    const { data: fallback } = await supabase
      .from('lifestyle_scene_tags')
      .select('scene_id')
      .eq('outfit_type', outfit_type)
    
    console.log('[Lifestyle] Fallback match:', fallback?.length || 0, 'scenes')
    return fallback?.map((r: any) => r.scene_id) || []
  } catch (error: any) {
    console.error('[Lifestyle] Scene filtering failed:', error.message)
    return []
  }
}

// Step 3: AI match models and scenes
async function matchModelsAndScenes(
  client: ReturnType<typeof getGenAIClient>,
  supabase: any,
  productImageData: string,
  productTag: ProductTag,
  sceneIdList: string[]
): Promise<LifestyleMatchResult | null> {
  try {
    console.log('[Lifestyle] Step 3: Matching models and scenes...')
    
    // 3.1 Get filtered scene tags (only scenes in sceneIdList)
    const { data: sceneTags, error: sceneError } = await supabase
      .from('lifestyle_scene_tags')
      .select('*')
      .in('scene_id', sceneIdList)
    
    if (sceneError || !sceneTags || sceneTags.length === 0) {
      console.error('[Lifestyle] Failed to get scene tags:', sceneError)
      return null
    }
    
    // 3.2 Get all models data
    const { data: modelsData, error: modelsError } = await supabase
      .from('models_analysis')
      .select('model_id, model_gender, model_age_group, model_style_primary, model_style_all, height_range, body_shape, model_desc')
    
    if (modelsError || !modelsData || modelsData.length === 0) {
      console.error('[Lifestyle] Failed to get models:', modelsError)
      return null
    }
    
    console.log('[Lifestyle] Matching from', sceneTags.length, 'scenes and', modelsData.length, 'models')
    
    // 3.3 Build prompt and call AI
    const prompt = buildLifestyleMatchPrompt(
      JSON.stringify(productTag, null, 2),
      JSON.stringify(sceneTags, null, 2),
      JSON.stringify(modelsData.map((m: any) => ({
        model_id: m.model_id,
        gender: m.model_gender,
        age_group: m.model_age_group,
        style: m.model_style_primary,
        height: m.height_range,
        body: m.body_shape,
        desc: m.model_desc?.substring(0, 150) + '...',
      })), null, 2)
    )
    
    const response = await client.models.generateContent({
      model: VLM_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: productImageData } },
        ],
      }],
      config: { safetySettings },
    })
    
    const text = extractText(response)
    if (!text) {
      console.error('[Lifestyle] Match AI returned empty response')
      return null
    }
    
    // Parse JSON response
    let jsonText = text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }
    
    // Try to extract JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
    }
    
    const result = JSON.parse(jsonText) as LifestyleMatchResult
    console.log('[Lifestyle] Match result:', result)
    
    return result
  } catch (error: any) {
    console.error('[Lifestyle] Matching failed:', error.message)
    return null
  }
}

// Step 4: Fetch material images
async function fetchMaterialImages(
  matchResult: LifestyleMatchResult
): Promise<{ modelImages: (string | null)[], sceneImages: (string | null)[] }> {
  console.log('[Lifestyle] Step 4: Fetching material images...')
  
  const modelIds = [
    matchResult.model_id_1,
    matchResult.model_id_2,
    matchResult.model_id_3,
    matchResult.model_id_4,
  ]
  
  const sceneIds = [
    matchResult.scene_id_1,
    matchResult.scene_id_2,
    matchResult.scene_id_3,
    matchResult.scene_id_4,
  ]
  
  // Fetch all images in parallel
  const [modelImages, sceneImages] = await Promise.all([
    Promise.all(modelIds.map(async (modelId) => {
      // Try .jpg first, then .png
      let base64 = await fetchImageAsBase64(`${ALL_MODELS_STORAGE_URL}/${modelId}.jpg`)
      if (!base64) {
        base64 = await fetchImageAsBase64(`${ALL_MODELS_STORAGE_URL}/${modelId}.png`)
      }
      return base64
    })),
    Promise.all(sceneIds.map(async (sceneId) => {
      // Try .jpg first, then .png
      let base64 = await fetchImageAsBase64(`${LIFESTYLE_SCENE_STORAGE_URL}/${sceneId}.jpg`)
      if (!base64) {
        base64 = await fetchImageAsBase64(`${LIFESTYLE_SCENE_STORAGE_URL}/${sceneId}.png`)
      }
      return base64
    })),
  ])
  
  console.log('[Lifestyle] Fetched models:', modelImages.filter(Boolean).length, '/', NUM_IMAGES)
  console.log('[Lifestyle] Fetched scenes:', sceneImages.filter(Boolean).length, '/', NUM_IMAGES)
  
  return { modelImages, sceneImages }
}

// Step 5: Generate single lifestyle image
async function generateLifestyleImage(
  client: ReturnType<typeof getGenAIClient>,
  productImageData: string,
  modelImageData: string,
  sceneImageData: string,
  index: number,
  outfitProductImages?: { slot: string; data: string }[]
): Promise<{ image: string; model: 'pro' | 'flash' } | null> {
  const label = `[Lifestyle-${index}]`
  
  try {
    console.log(`${label} Generating image...`)
    
    // Build parts dynamically based on whether it's outfit mode
    const parts: any[] = [{ text: LIFESTYLE_FINAL_PROMPT }]
    
    if (outfitProductImages && outfitProductImages.length > 1) {
      // Outfit mode: include all product images with labels
      const slotLabels: Record<string, string> = {
        'top': '上衣',
        'pants': '裤子/裙子',
        'inner': '内衬',
        'hat': '帽子',
        'shoes': '鞋子'
      }
      
      parts.push({ text: '\n\n【搭配模式 - 多件商品】\n请让模特同时穿上以下所有商品:' })
      
      for (const item of outfitProductImages) {
        parts.push({ text: `\n\n[${slotLabels[item.slot] || item.slot}]:` })
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: item.data } })
      }
    } else {
      // Single product mode
      parts.push({ text: '\n\n[商品图]:' })
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: productImageData } })
    }
    
    parts.push({ text: '\n\n[模特图]:' })
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: modelImageData } })
    parts.push({ text: '\n\n[参考场景图]:' })
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: sceneImageData } })
    
    // Try primary model
    try {
      const response = await client.models.generateContent({
        model: PRIMARY_IMAGE_MODEL,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['IMAGE'],
          safetySettings,
        },
      })
      
      const imageData = extractImage(response)
      if (imageData) {
        console.log(`${label} Success with ${PRIMARY_IMAGE_MODEL}`)
        return { image: imageData, model: 'pro' }
      }
    } catch (error: any) {
      console.error(`${label} Primary model failed:`, error.message)
    }
    
    // Try fallback model
    try {
      const response = await client.models.generateContent({
        model: FALLBACK_IMAGE_MODEL,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['IMAGE'],
          safetySettings,
        },
      })
      
      const imageData = extractImage(response)
      if (imageData) {
        console.log(`${label} Success with ${FALLBACK_IMAGE_MODEL}`)
        return { image: imageData, model: 'flash' }
      }
    } catch (error: any) {
      console.error(`${label} Fallback model failed:`, error.message)
    }
    
    return null
  } catch (error: any) {
    console.error(`${label} Generation failed:`, error.message)
    return null
  }
}

// Main API handler
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      
      try {
        const body = await request.json()
        const { productImage, modelImage, sceneImage, taskId, outfitItems } = body
        
        // Support both single product (productImage) and multiple products (outfitItems)
        // outfitItems format: { inner?: string, top?: string, pants?: string, hat?: string, shoes?: string }
        const isOutfitMode = !!outfitItems && Object.keys(outfitItems).length > 0
        
        // modelImage and sceneImage can be:
        // - 'auto': AI will match automatically
        // - base64 string: User uploaded custom image
        // - URL string: User selected from preset
        const useAutoModel = !modelImage || modelImage === 'auto'
        const useAutoScene = !sceneImage || sceneImage === 'auto'
        
        // Auth check
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          send({ type: 'error', error: 'Unauthorized' })
          controller.close()
          return
        }
        
        const userId = user.id
        const client = getGenAIClient()
        
        // Validate input: need either productImage or outfitItems
        if (!productImage && !isOutfitMode) {
          send({ type: 'error', error: 'Missing product image' })
          controller.close()
          return
        }
        
        if (!taskId) {
          send({ type: 'error', error: 'Missing task ID' })
          controller.close()
          return
        }
        
        // Convert product image(s) to base64
        send({ type: 'status', message: 'Processing product image...' })
        
        // For outfit mode, collect all product images
        let allProductImageData: { slot: string; data: string }[] = []
        let primaryProductImageData: string | null = null
        
        if (isOutfitMode) {
          // Process all outfit items
          const slotOrder = ['top', 'pants', 'inner', 'hat', 'shoes']
          for (const slot of slotOrder) {
            const imageUrl = outfitItems[slot]
            if (imageUrl) {
              const base64 = await ensureBase64Data(imageUrl)
              if (base64) {
                allProductImageData.push({ slot, data: base64 })
                if (!primaryProductImageData) {
                  primaryProductImageData = base64 // First valid image as primary
                }
              }
            }
          }
          
          if (allProductImageData.length === 0) {
            send({ type: 'error', error: 'Failed to process clothing image' })
            controller.close()
            return
          }
          
          console.log(`[Lifestyle] Outfit mode: ${allProductImageData.length} items - ${allProductImageData.map(p => p.slot).join(', ')}`)
        }
        
        // Single product mode or fallback
        const productImageData = primaryProductImageData || await ensureBase64Data(productImage)
        
        if (!productImageData) {
          send({ type: 'error', error: 'Failed to process product image' })
          controller.close()
          return
        }
        
        // ========== Step 1: Product Analysis ==========
        send({ type: 'status', message: 'Analyzing clothing style...' })
        const productTag = await analyzeProduct(client, productImageData)
        
        if (!productTag) {
          send({ type: 'error', error: 'Clothing analysis failed, please retry' })
          controller.close()
          return
        }
        
        send({ type: 'analysis_complete', productTag })
        
        // ========== Step 2 & 3: Filter and Match ==========
        let matchResult: LifestyleMatchResult | null = null
        let userModelImageData: string | null = null
        let userSceneImageData: string | null = null
        
        // Convert user-provided images to base64 if provided
        if (!useAutoModel && modelImage) {
          send({ type: 'status', message: 'Processing custom model image...' })
          userModelImageData = await ensureBase64Data(modelImage)
          console.log('[Lifestyle] User provided custom model image')
        }
        
        if (!useAutoScene && sceneImage) {
          send({ type: 'status', message: 'Processing custom scene image...' })
          userSceneImageData = await ensureBase64Data(sceneImage)
          console.log('[Lifestyle] User provided custom scene image')
        }
        
        // If user provided both custom images, skip AI matching entirely
        if (userModelImageData && userSceneImageData) {
          console.log('[Lifestyle] Using both custom model and scene, skipping AI match')
          // Create a dummy match result - images will be overridden anyway
          matchResult = {
            model_id_1: 'custom',
            model_id_2: 'custom',
            model_id_3: 'custom',
            model_id_4: 'custom',
            scene_id_1: 'custom',
            scene_id_2: 'custom',
            scene_id_3: 'custom',
            scene_id_4: 'custom',
          }
        } else {
          // Need AI matching for at least one of model/scene
          send({ type: 'status', message: 'Filtering matching scenes...' })
          const sceneIdList = await filterScenesByTag(supabase, productTag)
          
          if (sceneIdList.length === 0) {
            send({ type: 'error', error: 'No matching scenes found' })
            controller.close()
            return
          }
          
          send({ type: 'status', message: 'AI matching models and scenes...' })
          const aiMatchResult = await matchModelsAndScenes(
            client,
            supabase,
            productImageData,
            productTag,
            sceneIdList
          )
          
          if (!aiMatchResult) {
            send({ type: 'error', error: 'Model and scene matching failed' })
            controller.close()
            return
          }
          
          matchResult = aiMatchResult
        }
        
        // ========== Step 4: Fetch Materials ==========
        send({ type: 'status', message: 'Fetching model and scene assets...' })
        
        let modelImages: (string | null)[]
        let sceneImages: (string | null)[]
        
        if (userModelImageData && userSceneImageData) {
          // Both custom: use same image for all 4 slots
          modelImages = [userModelImageData, userModelImageData, userModelImageData, userModelImageData]
          sceneImages = [userSceneImageData, userSceneImageData, userSceneImageData, userSceneImageData]
          console.log('[Lifestyle] Using custom images for all slots')
        } else if (userModelImageData) {
          // Custom model, AI scenes
          const fetched = await fetchMaterialImages(matchResult!)
          modelImages = [userModelImageData, userModelImageData, userModelImageData, userModelImageData]
          sceneImages = fetched.sceneImages
          console.log('[Lifestyle] Using custom model + AI scenes')
        } else if (userSceneImageData) {
          // AI models, custom scene
          const fetched = await fetchMaterialImages(matchResult!)
          modelImages = fetched.modelImages
          sceneImages = [userSceneImageData, userSceneImageData, userSceneImageData, userSceneImageData]
          console.log('[Lifestyle] Using AI models + custom scene')
        } else {
          // Full AI mode
          const fetched = await fetchMaterialImages(matchResult!)
          modelImages = fetched.modelImages
          sceneImages = fetched.sceneImages
          console.log('[Lifestyle] Using full AI matching')
        }
        
        // Send materials ready event
        send({
          type: 'materials_ready',
          models: userModelImageData ? ['custom', 'custom', 'custom', 'custom'] : [
            matchResult!.model_id_1,
            matchResult!.model_id_2,
            matchResult!.model_id_3,
            matchResult!.model_id_4,
          ],
          scenes: userSceneImageData ? ['custom', 'custom', 'custom', 'custom'] : [
            matchResult!.scene_id_1,
            matchResult!.scene_id_2,
            matchResult!.scene_id_3,
            matchResult!.scene_id_4,
          ],
        })
        
        // ========== Step 5: Generate Images ==========
        send({ type: 'status', message: 'Generating street style photos...' })
        
        // Upload input image once
        let inputImageUrl: string | undefined
        const inputUploaded = await uploadImageToStorage(productImage, userId, `lifestyle_${taskId}_input`)
        if (inputUploaded) {
          inputImageUrl = inputUploaded
        }
        
        // Generate images in parallel
        const generatePromises = Array.from({ length: NUM_IMAGES }, (_, i) => i).map(async (i) => {
          send({ type: 'progress', index: i })
          
          const modelImageData = modelImages[i]
          const sceneImageData = sceneImages[i]
          
          if (!modelImageData || !sceneImageData) {
            console.error(`[Lifestyle-${i}] Missing material: model=${!!modelImageData}, scene=${!!sceneImageData}`)
            send({ type: 'image_error', index: i, error: 'Failed to fetch assets' })
            return null
          }
          
          const result = await generateLifestyleImage(
            client,
            productImageData,
            modelImageData,
            sceneImageData,
            i,
            isOutfitMode ? allProductImageData : undefined
          )
          
          if (!result) {
            send({ type: 'image_error', index: i, error: 'Image generation failed' })
            return null
          }
          
          // Upload generated image
          const base64Image = `data:image/png;base64,${result.image}`
          const uploaded = await uploadImageToStorage(base64Image, userId, `lifestyle_${taskId}_${i}`)
          
          if (!uploaded) {
            send({ type: 'image_error', index: i, error: 'Image upload failed' })
            return null
          }
          
          // Save to database
          const modelIds = [matchResult.model_id_1, matchResult.model_id_2, matchResult.model_id_3, matchResult.model_id_4]
          const sceneIds = [matchResult.scene_id_1, matchResult.scene_id_2, matchResult.scene_id_3, matchResult.scene_id_4]
          
          const saveResult = await appendImageToGeneration({
            taskId,
            userId,
            imageIndex: i,
            imageUrl: uploaded,
            modelType: result.model,
            genMode: 'simple',
            prompt: `LifeStyle Mode${isOutfitMode ? ' (Outfit)' : ''} - Model: ${modelIds[i]}, Scene: ${sceneIds[i]}`,
            taskType: 'lifestyle',
            inputImageUrl: i === 0 ? inputImageUrl : undefined,
            inputParams: i === 0 ? {
              type: 'lifestyle',
              productImage: inputImageUrl,
              modelId: modelIds[i],
              sceneId: sceneIds[i],
              productTag: JSON.stringify(productTag),
              isOutfitMode,
              outfitSlots: isOutfitMode ? allProductImageData.map(p => p.slot) : undefined,
            } : undefined,
          })
          
          send({
            type: 'image',
            index: i,
            image: uploaded,
            modelType: result.model,
            modelId: modelIds[i],
            sceneId: sceneIds[i],
            ...(saveResult.dbId ? { dbId: saveResult.dbId } : {}),
          })
          
          return { index: i, success: true }
        })
        
        // Wait for all generations to complete
        await Promise.all(generatePromises)
        
        send({ type: 'complete' })
        controller.close()
        
      } catch (error: any) {
        console.error('[Lifestyle] Unexpected error:', error)
        send({ type: 'error', error: error.message || 'Generation failed' })
        controller.close()
      }
    },
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

