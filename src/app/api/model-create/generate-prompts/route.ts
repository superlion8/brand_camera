import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'

export const maxDuration = 60

// New model prompt
const NEW_MODEL_PROMPT = `# Role
Professional AI Art Prompt Engineer & Fashion Casting Director

# Input Data
User Selected Reference Models: ['image1','image2','image3','image4'] (Visual References for vibe).
Goal: Create 4 distinct, high-quality text prompts to generate new fashion models. Gender and ethnicity should be consistent with the reference models.

# Analysis Dimensions (Focus on creating idealized versions)
- Demographics: Analyze and  adhere to the Gender and Ethnicity/Race of the selected references.
- Physique: Vibe from references, but translated into idealized fashion proportions.
- Facial Features: Bone structure, eye shape. Distinctive features consistent with references.
- Vibe/Aura: The mood derived from references.

# Instruction
- You MUST enforce strict anatomical standards in the generated prompts. The generated models must not look like average people; they must look like high-fashion professional models.
- Always specify "8-head tall figure" or "idealized fashion proportions".
- Emphasize "long legs," "slender frame," "graceful posture," and "anatomically correct structure".
- The gender and ethnicity of the new model should be consistent with input models. 

# Task
Generate 4 separate, highly detailed text prompts for image generation based on the analysis, strict demographic matching, and anatomical rules.

# Constraint Checklist & Confidence Score
1. Format: English text prompts only.
2. Identity Match: Prompt starts with specific Gender and Ethnicity keywords matching the user selection.
3. Anatomy Constraint： Prompt explicitly includes keywords for idealized 8-head fashion proportions and correct anatomy. No distorted limbs.
4. View: Full body shot, front facing.
5. Aspect Ratio implied: "Vertical composition, 9:16 framing, fashion magazine editorial style".
6. Quality Keywords: "8k resolution, photorealistic, detailed skin texture, masterpiece".

# Output Format
Strictly return a JSON object.
{
  "generated_prompts": {
    "prompt1": "Full English prompt for model 1, starting with gender/ethnicity, including anatomical constraints...",
    "prompt2": "Full English prompt for model 2, starting with gender/ethnicity, including anatomical constraints...",
    "prompt3": "Full English prompt for model 3, starting with gender/ethnicity, including anatomical constraints...",
    "prompt4": "Full English prompt for model 4, starting with gender/ethnicity, including anatomical constraints..."
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

