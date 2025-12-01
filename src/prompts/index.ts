export const PRODUCT_PROMPT = `请把这个商品拍成一个专业电商摄影棚拍出来的商品展示图。需要100%还原商品的细节，不能随意加或删减商品的任何元素。`

export const buildModelPrompt = (params: {
  hasModel: boolean
  modelStyle?: string
  modelGender?: string
  hasBackground: boolean
  hasVibe: boolean
}) => {
  let prompt = `You are a professional brand photographer, good at shooting social media ready photos for a specific product.

Design a suitable idol look model for the product shown in {{product}}.`

  if (params.hasModel) {
    prompt += `\n\nUse the model shown in {{model}}`
  }
  
  // Add style specification
  if (params.modelStyle && params.modelStyle !== 'auto') {
    const styleMap: Record<string, string> = {
      japanese: 'Japanese',
      korean: 'Korean',
      chinese: 'Chinese',
      western: 'Western'
    }
    prompt += `, in a style of ${styleMap[params.modelStyle]}`
  }

  // Add gender specification
  if (params.modelGender) {
    const genderMap: Record<string, string> = {
      male: 'male',
      female: 'female'
    }
    prompt += `, gender is ${genderMap[params.modelGender]}`
  }

  prompt += `.`

  if (params.hasBackground) {
    prompt += `\n\nThe background should be consistent to {{background}}`
    if (params.modelStyle && params.modelStyle !== 'auto') {
      const styleMap: Record<string, string> = {
        japanese: 'Japanese',
        korean: 'Korean',
        chinese: 'Chinese',
        western: 'Western'
      }
      prompt += `, and follow the style of ${styleMap[params.modelStyle]}`
    }
    prompt += `.`
  }

  if (params.hasVibe) {
    prompt += `\n\nMake the vibe consistent to {{vibe}}.`
  }

  prompt += `

Make the light natural.

The color/size/design/detail must be exactly same with {{product}}.

Negatives: exaggerated or distorted anatomy, fake portrait-mode blur, CGI/illustration look, unnatural merge of background and character, 贴图感.`

  return prompt
}

// 氛围模式专用 prompt - 当用户选择了氛围图时使用
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
