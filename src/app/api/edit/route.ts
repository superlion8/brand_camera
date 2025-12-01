import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractImage, safetySettings } from '@/lib/genai'
import { buildModelPrompt, EDIT_PROMPT_PREFIX } from '@/prompts'
import { stripBase64Prefix, generateId } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { saveGenerationServer } from '@/lib/supabase/generations-server'
import { uploadGeneratedImageServer, uploadInputImageServer } from '@/lib/supabase/storage-server'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const body = await request.json()
    const { inputImage, modelImage, modelStyle, modelGender, backgroundImage, vibeImage, customPrompt } = body
    
    if (!inputImage) {
      return NextResponse.json({ success: false, error: '缺少输入图片' }, { status: 400 })
    }
    
    // Get user ID for database recording (optional)
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id || null
    } catch (e) {
      console.log('Could not get user ID:', e)
    }
    
    const client = getGenAIClient()
    
    // Build prompt
    let prompt = ''
    if (customPrompt) {
      prompt = EDIT_PROMPT_PREFIX + customPrompt
    } else {
      prompt = buildModelPrompt({
        hasModel: !!modelImage,
        modelStyle,
        modelGender,
        hasBackground: !!backgroundImage,
        hasVibe: !!vibeImage,
      })
    }
    
    const parts: any[] = []
    
    // Add model reference image first if provided
    if (modelImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: stripBase64Prefix(modelImage),
        },
      })
    }
    
    // Add prompt
    parts.push({ text: prompt })
    
    // Add input image
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: stripBase64Prefix(inputImage),
      },
    })
    
    // Add background reference
    if (backgroundImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: stripBase64Prefix(backgroundImage),
        },
      })
    }
    
    // Add vibe reference
    if (vibeImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: stripBase64Prefix(vibeImage),
        },
      })
    }
    
    console.log('Editing image...')
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['IMAGE'],
        safetySettings,
      },
    })
    
    const resultImage = extractImage(response)
    const duration = Date.now() - startTime
    
    if (!resultImage) {
      // Save failed edit record
      if (userId) {
        saveGenerationServer(
          userId,
          'edit',
          { modelStyle, modelGender, customPrompt },
          [],
          duration,
          'failed',
          '图片编辑失败'
        ).catch(console.error)
      }
      
      return NextResponse.json({ 
        success: false, 
        error: '图片编辑失败，请重试' 
      }, { status: 500 })
    }
    
    let outputUrl = `data:image/png;base64,${resultImage}`
    const generationId = generateId()
    
    // If user is logged in, upload to Supabase Storage
    if (userId) {
      console.log('Uploading edited image to Supabase Storage...')
      
      // Upload output image
      const storageUrl = await uploadGeneratedImageServer(outputUrl, generationId, 0, userId)
      if (storageUrl) {
        outputUrl = storageUrl
        console.log('Successfully uploaded to storage')
      }
      
      // Also upload input image
      uploadInputImageServer(inputImage, generationId, userId).catch(console.error)
      
      // Save edit record with storage URL
      saveGenerationServer(
        userId,
        'edit',
        {
          modelStyle,
          modelGender,
          customPrompt,
          modelImageUrl: modelImage ? '[provided]' : undefined,
          backgroundImageUrl: backgroundImage ? '[provided]' : undefined,
          vibeImageUrl: vibeImage ? '[provided]' : undefined,
        },
        [outputUrl],
        duration,
        'completed'
      ).catch(console.error)
    }
    
    return NextResponse.json({
      success: true,
      image: outputUrl,
      generationId,
    })
    
  } catch (error: any) {
    console.error('Edit error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || '编辑失败' 
    }, { status: 500 })
  }
}
