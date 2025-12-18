import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 60

// New model prompt
const NEW_MODEL_PROMPT = `# Role
Professional AI Art Prompt Engineer

# Input Data
User Selected Reference Models: ['image1','image2','image3','image4'] (These are visual references).
Goal: Create 4 distinct, high-quality text prompts to generate new fashion models that share a similar vibe/category with the references but are unique. Gender and ethnicity should be consistent with the reference models.

# Analysis Dimensions
- Physique: Body type, height, skin tone.
- Facial Features: Bone structure, eye shape, distinct features.
- Vibe/Aura: Cool, warm, energetic, high-fashion, approachable.
- Photography Style: Lighting (softbox, sunlight), background (studio, street), composition (full body).

# Task
1. Analyze the visual features of the selected reference images.
2. Generate 4 separate, highly detailed text prompts for image generation.

# Constraint Checklist & Confidence Score
1. Format: English text prompts only.
2. View: Full body shot, front facing.
3. Aspect Ratio implied in prompt: "Vertical composition, 9:16 framing, fashion magazine editorial style".
4. Quality Keywords: "8k resolution, photorealistic, raw photo, detailed skin texture, masterpiece".
5. Background: "Professional studio backdrop" or "Minimalist architectural background".

# Output Format
Strictly return a JSON object.
{
  "analysis_summary": "Brief summary of the visual consensus of selected models",
  "generated_prompts": {
    "prompt1": "Full English prompt for model 1...",
    "prompt2": "Full English prompt for model 2...",
    "prompt3": "Full English prompt for model 3...",
    "prompt4": "Full English prompt for model 4..."
  }
}`

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
    const { selectedModelImages } = body
    
    if (!selectedModelImages || selectedModelImages.length === 0) {
      return NextResponse.json({ success: false, error: '缺少模特参考图' }, { status: 400 })
    }
    
    const client = getGenAIClient()
    const parts: any[] = [{ text: NEW_MODEL_PROMPT }]
    
    // Add model images
    for (const image of selectedModelImages) {
      const imageData = await ensureBase64Data(image)
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData,
        },
      })
    }
    
    console.log('[Generate Prompts] Calling Gemini with', selectedModelImages.length, 'model images')
    
    // Call Gemini
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ role: 'user', parts }],
      config: {
        safetySettings,
      },
    })
    
    const textResult = extractText(response)
    
    if (!textResult) {
      return NextResponse.json({ success: false, error: 'AI 生成失败，请重试' }, { status: 500 })
    }
    
    // Parse JSON response
    let result
    try {
      const jsonMatch = textResult.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', textResult)
      return NextResponse.json({ success: false, error: 'AI 返回格式错误，请重试' }, { status: 500 })
    }
    
    // Extract prompts
    const prompts = [
      result.generated_prompts?.prompt1,
      result.generated_prompts?.prompt2,
      result.generated_prompts?.prompt3,
      result.generated_prompts?.prompt4,
    ].filter(Boolean)
    
    if (prompts.length === 0) {
      return NextResponse.json({ success: false, error: 'AI 未能生成有效的描述' }, { status: 500 })
    }
    
    console.log('[Generate Prompts] Success:', prompts.length, 'prompts generated')
    
    return NextResponse.json({
      success: true,
      analysisSummary: result.analysis_summary || '',
      prompts,
    })
    
  } catch (error: any) {
    console.error('Generate prompts error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '生成失败，请重试'
    }, { status: 500 })
  }
}

