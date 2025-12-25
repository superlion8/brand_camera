import { NextRequest, NextResponse } from 'next/server'
import { getGenAIClient, extractText, safetySettings } from '@/lib/genai'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 120 // 2 minutes

// Storage URL for model images
const ALL_MODELS_URL = 'https://cvdogeigbpussfamctsu.supabase.co/storage/v1/object/public/presets/all_models'

// Match Prompt - 用于 VLM 模糊匹配
const MATCH_PROMPT = `[user_prompt]是用户对于服装模特的定制化要求。
请仔细阅读[model json数据库]中的model_desc字段，选取你认为与[user_prompt]相匹配的模特，输出选择一个模特id。
以list格式输出：[model_id1,model_id2....]

[user_prompt]:
{user_prompt}

[model json数据库]:
{model_database}`

export async function POST(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  
  try {
    const body = await request.json()
    const { 
      ageGroup,      // 年龄组: YoungAdult, Adult, etc.
      gender,        // 性别: male, female
      ethnicity,     // 人种: White, Black, Asian, etc.
      userPrompt,    // 用户额外输入（可选）
    } = body
    
    if (!gender) {
      return NextResponse.json({ success: false, error: '请选择性别' }, { status: 400 })
    }
    
    console.log(`[MatchModels] Query params - gender: ${gender}, ageGroup: ${ageGroup}, ethnicity: ${ethnicity}`)
    
    // Fetch models_analysis from database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: '服务器配置错误' }, { status: 500 })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Step 1: 精确匹配 - 召回符合条件的模特
    // 尝试完全匹配
    let query = supabase
      .from('models_analysis')
      .select('model_id, model_gender, model_age_group, model_ethnicity, model_style_primary, model_desc')
    
    // 性别筛选（使用 ilike 进行大小写不敏感匹配）
    if (gender) {
      query = query.ilike('model_gender', gender)
    }
    
    // 年龄组筛选（使用 ilike 进行大小写不敏感匹配）
    if (ageGroup) {
      query = query.ilike('model_age_group', ageGroup)
    }
    
    // 人种筛选（使用 ilike 进行大小写不敏感匹配）
    if (ethnicity) {
      query = query.ilike('model_ethnicity', ethnicity)
    }
    
    let { data: matchedModels, error: dbError } = await query
    
    if (dbError) {
      console.error('[MatchModels] Database error:', dbError)
      return NextResponse.json({ success: false, error: '获取模特数据失败' }, { status: 500 })
    }
    
    // 如果完全匹配没有结果，尝试逐步放宽条件
    let matchStrategy = 'exact'
    
    if (!matchedModels || matchedModels.length === 0) {
      console.log(`[MatchModels] No exact match for: gender=${gender}, ageGroup=${ageGroup}, ethnicity=${ethnicity}`)
      
      // 尝试 性别 + 人种（放宽年龄）
      if (ethnicity) {
        const { data: genderEthnicityModels } = await supabase
          .from('models_analysis')
          .select('model_id, model_gender, model_age_group, model_ethnicity, model_style_primary, model_desc')
          .ilike('model_gender', gender)
          .ilike('model_ethnicity', ethnicity)
        
        if (genderEthnicityModels && genderEthnicityModels.length > 0) {
          matchedModels = genderEthnicityModels
          matchStrategy = 'gender+ethnicity'
          console.log(`[MatchModels] Found ${matchedModels.length} models with gender+ethnicity`)
        }
      }
    }
    
    if (!matchedModels || matchedModels.length === 0) {
      // 尝试 性别 + 年龄（放宽人种）
      if (ageGroup) {
        const { data: genderAgeModels } = await supabase
          .from('models_analysis')
          .select('model_id, model_gender, model_age_group, model_ethnicity, model_style_primary, model_desc')
          .ilike('model_gender', gender)
          .ilike('model_age_group', ageGroup)
        
        if (genderAgeModels && genderAgeModels.length > 0) {
          matchedModels = genderAgeModels
          matchStrategy = 'gender+age'
          console.log(`[MatchModels] Found ${matchedModels.length} models with gender+age`)
        }
      }
    }
    
    if (!matchedModels || matchedModels.length === 0) {
      // 最后只用性别
      const { data: genderOnlyModels } = await supabase
        .from('models_analysis')
        .select('model_id, model_gender, model_age_group, model_ethnicity, model_style_primary, model_desc')
        .ilike('model_gender', gender)
      
      if (genderOnlyModels && genderOnlyModels.length > 0) {
        matchedModels = genderOnlyModels
        matchStrategy = 'gender-only'
        console.log(`[MatchModels] Found ${matchedModels.length} models with gender only`)
      }
    }
    
    if (!matchedModels || matchedModels.length === 0) {
      console.log(`[MatchModels] No models found even with gender=${gender} only`)
      
      return NextResponse.json({ 
        success: false, 
        error: '没有找到符合条件的模特，请调整筛选条件'
      }, { status: 404 })
    }
    
    console.log(`[MatchModels] Found ${matchedModels.length} models matching criteria`)
    
    let selectedModelIds: string[] = matchedModels.map(m => m.model_id)
    
    // Step 2: 如果用户有额外输入，使用 VLM 进行模糊匹配
    if (userPrompt && userPrompt.trim()) {
      console.log('[MatchModels] User has additional prompt, using VLM for fuzzy matching...')
      
      const client = getGenAIClient()
      
      // 构建模特数据库 JSON
      const modelDatabase = matchedModels.map(m => ({
        model_id: m.model_id,
        model_desc: m.model_desc?.substring(0, 200) + '...',
      }))
      
      const prompt = MATCH_PROMPT
        .replace('{user_prompt}', userPrompt)
        .replace('{model_database}', JSON.stringify(modelDatabase, null, 2))
      
      try {
        const response = await client.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: { safetySettings },
        })
        
        const textResult = extractText(response)
        
        if (textResult) {
          // 解析返回的 model_id 列表
          const listMatch = textResult.match(/\[([^\]]+)\]/)
          if (listMatch) {
            const idsStr = listMatch[1]
            const parsedIds = idsStr.split(',').map(id => id.trim().replace(/['"]/g, ''))
            // 只保留在 matchedModels 中存在的 ID
            const validIds = parsedIds.filter(id => 
              matchedModels.some(m => m.model_id === id)
            )
            if (validIds.length > 0) {
              selectedModelIds = validIds
              console.log(`[MatchModels] VLM selected ${validIds.length} models`)
            }
          }
        }
      } catch (vlmError) {
        console.warn('[MatchModels] VLM matching failed, using exact match results:', vlmError)
        // VLM 失败时继续使用精确匹配结果
      }
    }
    
    // Step 3: 从选中的模特中随机选择 1 个
    const randomIndex = Math.floor(Math.random() * selectedModelIds.length)
    const selectedModelId = selectedModelIds[randomIndex]
    
    // 获取选中模特的完整信息
    const selectedModel = matchedModels.find(m => m.model_id === selectedModelId)
    
    if (!selectedModel) {
      return NextResponse.json({ success: false, error: '选择模特失败' }, { status: 500 })
    }
    
    // 构建模特图片 URL - 先尝试 .png，如果不存在则用 .jpg
    let modelImageUrl = `${ALL_MODELS_URL}/${selectedModel.model_id}.png`
    
    // 验证图片是否存在
    try {
      const checkResponse = await fetch(modelImageUrl, { method: 'HEAD' })
      if (!checkResponse.ok) {
        // 尝试 .jpg
        const jpgUrl = `${ALL_MODELS_URL}/${selectedModel.model_id}.jpg`
        const jpgCheck = await fetch(jpgUrl, { method: 'HEAD' })
        if (jpgCheck.ok) {
          modelImageUrl = jpgUrl
          console.log(`[MatchModels] Using JPG format for model: ${selectedModel.model_id}`)
        } else {
          console.warn(`[MatchModels] Image not found for model: ${selectedModel.model_id}`)
        }
      }
    } catch (e) {
      console.warn(`[MatchModels] Failed to verify image URL:`, e)
    }
    
    console.log(`[MatchModels] Selected model: ${selectedModel.model_id}, imageUrl: ${modelImageUrl}`)
    
    return NextResponse.json({
      success: true,
      selectedModel: {
        modelId: selectedModel.model_id,
        gender: selectedModel.model_gender,
        ageGroup: selectedModel.model_age_group,
        ethnicity: selectedModel.model_ethnicity,
        style: selectedModel.model_style_primary,
        description: selectedModel.model_desc,
        imageUrl: modelImageUrl,
      },
      totalMatched: matchedModels.length,
      matchStrategy,
      usedVLM: !!(userPrompt && userPrompt.trim()),
    })
    
  } catch (error: any) {
    console.error('[MatchModels] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '匹配失败，请重试'
    }, { status: 500 })
  }
}

// GET 接口：获取可用的筛选选项
export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await requireAuth(request)
  if ('response' in authResult) {
    return authResult.response
  }
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: '服务器配置错误' }, { status: 500 })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // 获取所有唯一的筛选值
    const { data: models, error } = await supabase
      .from('models_analysis')
      .select('model_gender, model_age_group, model_ethnicity')
    
    if (error) {
      console.error('[MatchModels] Database error:', error)
      return NextResponse.json({ success: false, error: '获取数据失败' }, { status: 500 })
    }
    
    // 提取唯一值
    const genders = Array.from(new Set(models?.map(m => m.model_gender).filter(Boolean)))
    const ageGroups = Array.from(new Set(models?.map(m => m.model_age_group).filter(Boolean)))
    const ethnicities = Array.from(new Set(models?.map(m => m.model_ethnicity).filter(Boolean)))
    
    console.log(`[MatchModels] Available options - genders: ${JSON.stringify(genders)}, ageGroups: ${JSON.stringify(ageGroups)}, ethnicities: ${JSON.stringify(ethnicities)}`)
    console.log(`[MatchModels] Total models in database: ${models?.length || 0}`)
    
    return NextResponse.json({
      success: true,
      options: {
        genders,
        ageGroups,
        ethnicities,
      },
      totalModels: models?.length || 0,
    })
    
  } catch (error: any) {
    console.error('[MatchModels] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '获取选项失败'
    }, { status: 500 })
  }
}

