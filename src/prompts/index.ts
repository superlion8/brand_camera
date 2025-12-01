export const PRODUCT_PROMPT = `请把这个商品拍成一个专业电商摄影棚拍出来的商品展示图。需要100%还原商品的细节，不能随意加或删减商品的任何元素。`

// Step 1: Generate photography instructions
export const buildInstructPrompt = (params: {
  hasModel: boolean
  modelStyle?: string
  modelGender?: string
  hasBackground: boolean
  hasVibe: boolean
}) => {
  let prompt = `你是一个擅长拍摄小红书/instagram等社媒生活感照片的摄影师。

请你根据用户的商品图{{product}}`

  if (params.hasModel) {
    prompt += `、模特图{{model}}`
  }
  
  if (params.modelStyle && params.modelStyle !== 'auto') {
    const styleMap: Record<string, string> = {
      korean: '韩模风格',
      western: '外模风格'
    }
    prompt += `、模特风格${styleMap[params.modelStyle] || params.modelStyle}`
  }

  if (params.hasBackground) {
    prompt += `、背景图{{background}}`
  }

  if (params.hasVibe) {
    prompt += `、氛围图{{vibe}}`
  }

  prompt += `，

输出一段韩系审美、小红书和ins生活感风格的，适合模特展示商品的拍摄指令。请使用以下格式输出：

- composition：
- model pose：
- model expression：
- camera position：
- camera setting：
- lighting and color：`

  return prompt
}

// Step 2: Generate model image with instructions
export const buildModelPrompt = (params: {
  hasModel: boolean
  modelStyle?: string
  modelGender?: string
  hasBackground: boolean
  hasVibe: boolean
  instructPrompt?: string
}) => {
  let prompt = ''

  // Model description part
  if (params.hasModel) {
    prompt = `Take authentic photo of the {{model}} showing the {{product}}, use instagram friendly composition, 要有生活感.`
  } else {
    prompt = `Design a suitable idol look model for the product shown in {{product}}.`
    
    if (params.modelStyle && params.modelStyle !== 'auto') {
      const styleMap: Record<string, string> = {
        korean: 'Korean idol',
        western: 'Western'
      }
      prompt += ` In a style of ${styleMap[params.modelStyle] || params.modelStyle}`
    }
    
    if (params.modelGender) {
      prompt += `, gender is ${params.modelGender}`
    }
    
    prompt += `.`
  }

  // Background and vibe
  const conditions: string[] = []
  if (params.hasBackground) {
    conditions.push('the background should be consistent to {{background}}')
  }
  if (params.hasVibe) {
    conditions.push('make the vibe consistent to {{vibe}}')
  }
  if (conditions.length > 0) {
    prompt += `\n\n${conditions.join(', ')}.`
  }

  // Product fidelity
  prompt += `\n\nThe color/size/design/detail must be exactly same with {{product}}.`

  // Photography instructions from Step 1
  if (params.instructPrompt) {
    prompt += `\n\nPhoto shot instruction:\n${params.instructPrompt}`
  }

  // Negatives
  prompt += `\n\nNegatives: exaggerated or distorted anatomy, fake portrait-mode blur, CGI/illustration look, unnatural merge of background and character, 贴图感.`

  return prompt
}

// Legacy: 氛围模式专用 prompt - 当用户选择了氛围图时使用
export const buildVibePrompt = (vibeCaption?: string) => {
  let prompt = `You are a professional brand photographer, good at shooting social media ready photos for a specific product.

Design a suitable idol style model for the product shown in {{product}}.

Take authentic photo of the model wearing {{product}}, use instagram friendly composition.

The color/size/design/detail must be exactly same with {{product}}.`

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
