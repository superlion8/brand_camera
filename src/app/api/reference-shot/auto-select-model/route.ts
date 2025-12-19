import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

// Storage base URL for all_models
const ALL_MODELS_STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/all_models'

// Helper to ensure base64 data
async function ensureBase64Data(image: string): Promise<string> {
  if (image.startsWith('data:')) {
    return image.split(',')[1] || image
  }
  if (image.startsWith('http')) {
    const response = await fetch(image)
    const buffer = await response.arrayBuffer()
    return Buffer.from(buffer).toString('base64')
  }
  return image
}

export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  
  try {
    const body = await request.json()
    const { productImage } = body
    
    if (!productImage) {
      return NextResponse.json({ success: false, error: '缺少商品图片' }, { status: 400 })
    }
    
    // 1. Fetch all models from models_analysis table
    const supabase = await createClient()
    const { data: modelsData, error: modelsError } = await supabase
      .from('models_analysis')
      .select('model_id, model_gender, model_age_group, model_style_primary, model_desc')
    
    if (modelsError || !modelsData || modelsData.length === 0) {
      console.error('[AutoSelectModel] Failed to fetch models:', modelsError)
      return NextResponse.json({ success: false, error: '获取模特数据失败' }, { status: 500 })
    }
    
    // 2. Prepare models data as JSON string for the prompt
    const modelsJson = JSON.stringify(modelsData.map(m => ({
      model_id: m.model_id,
      gender: m.model_gender,
      age_group: m.model_age_group,
      style: m.model_style_primary,
      description: m.model_desc?.substring(0, 200) + '...' // Truncate for token limit
    })))
    
    // 3. Call Gemini to select the best model
    const client = getGenAIClient()
    
    const prompt = `Analyze the product image visually, and scan all the models from the model analysis database below.
Select one single model that can best show the traits of the product.

Model Database:
${modelsJson}

Output Schema: a strict JSON object with the model id only.
Example: {"model_id":"model15"}

Important: Only output the JSON object, no other text.`

    const imageData = await ensureBase64Data(productImage)
    
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageData,
            },
          },
        ],
      }],
      config: {
        safetySettings,
      },
    })
    
    const textResult = extractText(response)
    
    if (!textResult) {
      return NextResponse.json({ success: false, error: 'AI 分析失败' }, { status: 500 })
    }
    
    // 4. Parse the model_id from response
    let modelId: string | null = null
    try {
      // Try to extract JSON from response
      const jsonMatch = textResult.match(/\{[\s\S]*?"model_id"[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        modelId = parsed.model_id
      }
    } catch (e) {
      console.error('[AutoSelectModel] Failed to parse response:', textResult)
    }
    
    if (!modelId) {
      // Fallback: pick a random model
      const randomModel = modelsData[Math.floor(Math.random() * modelsData.length)]
      modelId = randomModel.model_id
      console.log('[AutoSelectModel] Using fallback random model:', modelId)
    }
    
    // 5. Get the model image URL from storage
    // Try .jpg first, then .png
    let modelImageUrl = `${ALL_MODELS_STORAGE_URL}/${modelId}.jpg`
    
    // Check if .jpg exists, otherwise try .png
    try {
      const checkResponse = await fetch(modelImageUrl, { method: 'HEAD' })
      if (!checkResponse.ok) {
        // Try .png
        const pngUrl = `${ALL_MODELS_STORAGE_URL}/${modelId}.png`
        const pngCheck = await fetch(pngUrl, { method: 'HEAD' })
        if (pngCheck.ok) {
          modelImageUrl = pngUrl
          console.log('[AutoSelectModel] Using .png format for model:', modelId)
        }
      }
    } catch (e) {
      console.warn('[AutoSelectModel] Could not verify image format, using .jpg')
    }
    
    console.log('[AutoSelectModel] Selected model:', modelId, 'URL:', modelImageUrl)
    
    return NextResponse.json({
      success: true,
      modelId,
      modelImageUrl,
    })
    
  } catch (error: any) {
    console.error('[AutoSelectModel] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '自动选择模特失败'
    }, { status: 500 })
  }
}

