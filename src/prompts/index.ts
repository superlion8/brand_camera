export const PRODUCT_PROMPT = `请把这个商品改成一个专业电商摄影棚拍出来的商品展示图。
要求：
- 专业的摄影棚灯光
- 干净简洁的背景
- 突出商品细节和质感
- 适合社交媒体发布的构图
- 保持商品的颜色、尺寸、设计和细节完全一致`

export const buildModelPrompt = (params: {
  hasModel: boolean
  modelStyle?: string
  modelGender?: string
  hasBackground: boolean
  hasVibe: boolean
}) => {
  let prompt = `You are a professional brand photographer, good at shooting social media ready photos for a specific product.

Design a stunning model photo featuring the product shown in the input image.`

  // Add gender specification
  if (params.modelGender) {
    const genderMap: Record<string, string> = {
      male: 'male model',
      female: 'female model'
    }
    prompt += `\n\nThe model should be a ${genderMap[params.modelGender]}.`
  }

  if (params.hasModel) {
    prompt += `\n\nUse the model shown in the reference model image. Keep the model's appearance consistent.`
  }
  
  if (params.modelStyle && params.modelStyle !== 'auto') {
    const styleMap: Record<string, string> = {
      japanese: 'Japanese aesthetic with soft, natural lighting and minimalist composition. The model should have East Asian features typical of Japanese fashion photography.',
      korean: 'Korean K-fashion style with trendy, youthful energy and clean aesthetics. The model should reflect Korean beauty standards.',
      chinese: 'Chinese contemporary style with elegant, sophisticated aesthetics. The model should embody modern Chinese fashion sensibilities.',
      western: 'Western editorial style with bold, fashion-forward approach. The model should have diverse Western features.'
    }
    prompt += `\n\nFollow a ${styleMap[params.modelStyle]}`
  }

  if (params.hasBackground) {
    prompt += `\n\nThe background should be consistent with the provided background reference image.`
  }

  if (params.hasVibe) {
    prompt += `\n\nMake the overall vibe, mood, and atmosphere consistent with the provided vibe reference image.`
  }

  prompt += `

Additional requirements:
- Make the lighting natural and professional
- The product's color, size, design, and details must be EXACTLY the same as the input product image
- Create a composition suitable for social media posting (Instagram, Xiaohongshu)
- Ensure the model's pose highlights the product naturally
- Output a high-quality, fashion-ready photograph`

  return prompt
}

export const EDIT_PROMPT_PREFIX = `You are a professional image editor. Based on the user's requirements, edit the provided image while maintaining the core elements.

User requirements: `

