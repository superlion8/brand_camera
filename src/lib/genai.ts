/**
 * Vertex AI Gemini API 工具函数
 * 使用 @google/genai SDK (API Key + Vertex AI 端点)
 */
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

// 关键：在模块加载时设置 Vertex AI 模式环境变量
if (typeof process !== 'undefined' && !process.env.GOOGLE_GENAI_USE_VERTEXAI) {
  process.env.GOOGLE_GENAI_USE_VERTEXAI = "true";
}

// GenAI 客户端缓存（单例）
let genAIClient: GoogleGenAI | null = null;

// 获取 API Key
function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return apiKey;
}

// 获取 GenAI 客户端（单例）- 使用 Vertex AI 端点
export function getGenAIClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = getApiKey();
    genAIClient = new GoogleGenAI({
      apiKey,
    });
  }
  return genAIClient;
}

// 安全设置配置 - 关闭所有安全过滤以适应服装展示需求
export const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

// Helper: 从响应中提取图片
export function extractImage(response: any): string | null {
  const candidate = response.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") {
    throw new Error("内容被安全过滤阻止，请尝试调整提示词或图片");
  }
  
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if ((part as any).inlineData?.data) {
        return (part as any).inlineData.data;
      }
    }
  }
  return null;
}

// Helper: 从响应中提取文本
export function extractText(response: any): string | null {
  const candidate = response.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") {
    console.warn("Text response blocked by safety filter");
    return null;
  }
  
  if (candidate?.content?.parts) {
    const textParts: string[] = [];
    for (const part of candidate.content.parts) {
      if (typeof part.text === 'string') {
        textParts.push(part.text);
      }
    }
    if (textParts.length > 0) {
      return textParts.join('\n');
    }
  }
  return null;
}

export { HarmCategory, HarmBlockThreshold };

