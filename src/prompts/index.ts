export const PRODUCT_PROMPT = `请把这个商品拍成一个专业电商摄影棚拍出来的商品展示图。需要100%还原商品的细节，不能随意加或删减商品的任何元素。`

// Step 1: Generate photography instructions using gemini-3-pro-preview (VLM)
export const buildInstructPrompt = (params: {
  hasModel: boolean
  modelStyle?: string
  hasBackground: boolean
  hasVibe: boolean
  hasProduct2?: boolean
}) => {
  // Build input description
  const inputs: string[] = ['商品图{{product}}']
  
  if (params.hasProduct2) {
    inputs.push('商品图2{{product2}}')
  }
  
  if (params.hasModel) {
    inputs.push('模特图{{model}}')
  }
  
  if (params.modelStyle && params.modelStyle !== 'auto') {
    const styleMap: Record<string, string> = {
      korean: '韩模风格',
      western: '外模风格'
    }
    inputs.push(`模特风格${styleMap[params.modelStyle] || params.modelStyle}`)
  }
  
  if (params.hasBackground) {
    inputs.push('背景图{{background}}')
  }
  
  if (params.hasVibe) {
    inputs.push('氛围{{vibe}}')
  }

  const inputList = inputs.join('、')

  const prompt = `你是一个擅长拍摄小红书/instagram等社媒生活感照片的摄影师。

请你根据用户的${inputList}，

输出一段韩系审美、小红书和ins的，适合模特展示商品的拍摄指令，要求是随意一点、有生活感。请使用以下格式输出：

- composition：
- model pose：
- model expression：
- camera position：
- camera setting：
- lighting and color:
- clothing:

输出的内容要尽量简单，不要包含太复杂的信息尽量控制在200字以内`

  return prompt
}

// Step 2: Generate model image with instructions using gemini-3-pro-image-preview
export const buildModelPrompt = (params: {
  hasModel: boolean
  modelStyle?: string
  modelGender?: string
  hasBackground: boolean
  hasVibe: boolean
  instructPrompt?: string
  hasProduct2?: boolean
}) => {
  // Product placeholder - handle multiple products
  const productPlaceholder = params.hasProduct2 ? '{{product}} and {{product2}}' : '{{product}}'

  let prompt = ''
  
  if (params.hasModel) {
    // When user has selected a model image
    prompt = `take authentic photo of a new model that looks like {{model}}, but do not have an exact same look.

the new model shows the ${productPlaceholder}, use instagram friendly composition, 要随意一点、有生活感.`
  } else {
    // When no model image is selected - generate model based on style and gender
    prompt = `design a suitable model for the product shown in ${productPlaceholder}.`
    
    if (params.modelStyle && params.modelStyle !== 'auto') {
      const styleMap: Record<string, string> = {
        korean: 'Korean idol',
        western: 'Western'
      }
      prompt += ` in a style of ${styleMap[params.modelStyle] || params.modelStyle}`
    }
    
    if (params.modelGender) {
      // Map gender values to English descriptions
      const genderMap: Record<string, string> = {
        female: 'female',
        male: 'male',
        girl: 'young girl (child)',
        boy: 'young boy (child)'
      }
      prompt += `, gender is ${genderMap[params.modelGender] || params.modelGender}`
    }
    
    prompt += `. 模特要自然、有生活感，符合韩系社交媒体自然的审美。`
  }

  // Background and vibe conditions - always add both lines
  prompt += `

the background should be consistent to {{background}}, make the vibe consistent to {{vibe}}.

the color/size/design/detail must be exactly same with ${productPlaceholder}.`

  // Photography instructions from Step 1
  if (params.instructPrompt) {
    prompt += `

photo shot instruction: ${params.instructPrompt}`
  }

  // Negatives
  prompt += `

negatives: exaggerated or distorted anatomy, fake portrait-mode blur, CGI/illustration look.`

  return prompt
}

// Legacy: 氛围模式专用 prompt - 当用户选择了氛围图时使用
export const buildVibePrompt = (vibeCaption?: string, hasProduct2?: boolean) => {
  const productPlaceholder = hasProduct2 ? '{{product}} and {{product2}}' : '{{product}}'
  
  let prompt = `You are a professional brand photographer, good at shooting social media ready photos for a specific product.

Design a suitable idol style model for the product shown in ${productPlaceholder}.

Take authentic photo of the model wearing ${productPlaceholder}, use instagram friendly composition.

The color/size/design/detail must be exactly same with ${productPlaceholder}.`

  if (vibeCaption) {
    prompt += `

Scene setup: ${vibeCaption}`
  }

  prompt += `

Negatives: exaggerated or distorted anatomy, fake portrait-mode blur, CGI/illustration look, unnatural merge of background and character, 贴图感.`

  return prompt
}

export const EDIT_PROMPT_PREFIX = `You are a professional image editor. Based on the user's requirements, edit the provided image while maintaining the core elements.

User requirements: `
