export const PRODUCT_PROMPT = `请把这个商品拍成一个专业电商摄影棚拍出来的商品展示图。需要100%还原商品的细节，不能随意加或删减商品的任何元素。`

// Step 1: Generate photography instructions using gemini-3-pro-preview (VLM)
// Input: product, model, background images
// Output: Structured photography instructions
export const buildInstructPrompt = () => {
  return `你是一个擅长拍摄小红书/instagram等社媒生活感照片的电商摄影师。

你先要理解{{product}}的版型和风格，然后根据模特图{{model}}、背景图{{background}}，输出一段韩系审美、小红书和ins的，适合模特展示商品{{product}}的拍摄指令，要求是随意一点、有生活感，是生活中用手机随手拍出来的效果。请使用以下格式用英文输出：

- composition：
- model pose：
- model expression：
- lighting and color:
- clothing:

输出的内容要尽量简单，不要包含太复杂的信息尽量控制在200字以内；

clothing部分整体的服装搭配要和{{model}}和{{product}}和谐，不要有奇怪的服装搭配`
}

// Step 2: Generate model image with instructions using gemini-3-pro-image-preview
// Input: product, model, background images + instruct_prompt from Step 1
export const buildModelPrompt = (params: {
  instructPrompt?: string
}) => {
  let prompt = `take autentic photo of a new model that looks like {{model}}, but do not have an exact same look. 

the new model shows the {{product}}, use instagram friendly composition, 要随意一点、有生活感，像是生活中用手机随手拍出来的图片.

the background shoule be consistent to {{background}}.

the color/size/design/detial must be exactly consistent with {{product}}.`

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
