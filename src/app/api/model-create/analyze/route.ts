import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 120 // 2 minutes

// Storage URL for model images
const STORAGE_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/all_models'

// Model select prompt
const MODEL_SELECT_PROMPT = `# Role
Brand Visual Director & Casting Director

# Context
We have product images provided below.
Target Reference Brand Style: {ref_brand}.
Model Database: {model_database} (Contains 'model_id', 'model_style', 'model_desc').

# Task
1. Product Analysis: Analyze the product images visually. Extract key fashion elements (material, cut, style) to create concise product descriptions for each product.
2. Brand Definition: Based on the products and the {ref_brand}, define the visual strategy (e.g., Minimalist, Streetwear, Luxury, Bohemian).
3. Casting: Scan the model database. Select 20 models whose 'model_style' and 'model_desc' best align with the defined Brand Visual Strategy.

# Output Format
Strictly return a JSON object. Do not output markdown code blocks.
{
  "brand_style_analysis": "Short analysis of the brand vibe",
  "product_descriptions": [
    "Visual desc of product 1",
    "Visual desc of product 2",
    ...
  ],
  "selected_model_ids": ["model2", "model3", ..., "model94"]
}

Important: 
- Return exactly 20 model_ids in selected_model_ids array
- Only use model_ids that exist in the provided database
- product_descriptions array length should match the number of product images provided`

// Helper to ensure base64 data
async function ensureBase64Data(image: string): Promise<string> {
  if (image.startsWith('data:')) {
    return image.split(',')[1] || image
  }
  if (image.startsWith('http')) {
    // Fetch and convert to base64
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
    const { productImages, brands } = body
    
    if (!productImages || productImages.length === 0) {
      return NextResponse.json({ success: false, error: '缺少商品图片' }, { status: 400 })
    }
    
    if (!brands || brands.length === 0) {
      return NextResponse.json({ success: false, error: '缺少品牌信息' }, { status: 400 })
    }
    
    // Fetch models_analysis from database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: '服务器配置错误' }, { status: 500 })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data: modelsData, error: dbError } = await supabase
      .from('models_analysis')
      .select('model_id, model_gender, model_age_group, model_style, model_desc')
    
    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ success: false, error: '获取模特数据失败' }, { status: 500 })
    }
    
    if (!modelsData || modelsData.length === 0) {
      return NextResponse.json({ success: false, error: '模特数据库为空' }, { status: 500 })
    }
    
    // Format model database for prompt
    const modelDatabase = modelsData.map(m => ({
      model_id: m.model_id,
      model_style: m.model_style,
      model_desc: m.model_desc?.substring(0, 200) + '...' // Truncate for context length
    }))
    
    // Build prompt
    const brandNames = brands.map((b: { name: string }) => b.name).join(', ')
    const prompt = MODEL_SELECT_PROMPT
      .replace('{ref_brand}', brandNames)
      .replace('{model_database}', JSON.stringify(modelDatabase, null, 2))
    
    // Build parts for Gemini
    const client = getGenAIClient()
    const parts: any[] = [{ text: prompt }]
    
    // Add product images
    for (const image of productImages) {
      const imageData = await ensureBase64Data(image)
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData,
        },
      })
    }
    
    console.log('[Model Select] Calling Gemini with', productImages.length, 'images and', brands.length, 'brands')
    
    // Call Gemini
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      contents: [{ role: 'user', parts }],
      config: {
        safetySettings,
      },
    })
    
    const textResult = extractText(response)
    
    if (!textResult) {
      return NextResponse.json({ success: false, error: 'AI 分析失败，请重试' }, { status: 500 })
    }
    
    // Parse JSON response
    let analysisResult
    try {
      // Try to extract JSON from the response
      const jsonMatch = textResult.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', textResult)
      return NextResponse.json({ success: false, error: 'AI 返回格式错误，请重试' }, { status: 500 })
    }
    
    // Validate response
    if (!analysisResult.selected_model_ids || !Array.isArray(analysisResult.selected_model_ids)) {
      return NextResponse.json({ success: false, error: 'AI 返回格式错误：缺少模特推荐' }, { status: 500 })
    }
    
    // Build full model data with image URLs
    const selectedModels = analysisResult.selected_model_ids
      .map((modelId: string) => {
        const modelData = modelsData.find(m => m.model_id === modelId)
        if (!modelData) return null
        
        // Determine file extension - check if it's jpg or png
        // For simplicity, we'll use lowercase model_id and try common extensions
        const baseId = modelId.toLowerCase()
        
        return {
          model_id: modelData.model_id,
          model_gender: modelData.model_gender,
          model_age_group: modelData.model_age_group,
          model_style: modelData.model_style,
          model_desc: modelData.model_desc,
          // Try png first (most common in the uploaded data)
          imageUrl: `${STORAGE_URL}/${baseId}.png`,
        }
      })
      .filter(Boolean)
    
    // Build product descriptions
    const productDescriptions = (analysisResult.product_descriptions || []).map(
      (desc: string, index: number) => ({
        index,
        description: desc,
      })
    )
    
    console.log('[Model Select] Success:', selectedModels.length, 'models recommended')
    
    return NextResponse.json({
      success: true,
      brandStyleAnalysis: analysisResult.brand_style_analysis || '',
      productDescriptions,
      recommendedModels: selectedModels,
    })
    
  } catch (error: any) {
    console.error('Analysis error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '分析失败，请重试'
    }, { status: 500 })
  }
}

