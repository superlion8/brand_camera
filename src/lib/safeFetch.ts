/**
 * Safe fetch utilities that properly handle various error responses
 * including non-JSON responses, streaming errors, and network failures
 */

export interface SafeFetchResult<T = any> {
  ok: boolean
  data?: T
  error?: string
  status?: number
}

/**
 * Safely fetch JSON from an API endpoint
 * Handles non-JSON responses, HTTP errors, and network failures
 */
export async function safeFetchJSON<T = any>(
  url: string,
  options?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const response = await fetch(url, options)
    
    // Get response text first to handle non-JSON responses
    const text = await response.text()
    
    // Log for debugging (only first 200 chars to avoid huge logs)
    if (!response.ok) {
      console.error(`[safeFetch] ${url} returned ${response.status}:`, text.substring(0, 200))
    }
    
    // Try to parse as JSON
    let data: T | undefined
    try {
      if (text) {
        data = JSON.parse(text)
      }
    } catch (parseError) {
      // Response is not JSON
      console.error(`[safeFetch] ${url} returned non-JSON response:`, text.substring(0, 100))
      
      // Try to extract meaningful error message from text
      let errorMsg = getErrorFromText(text, response.status)
      
      return {
        ok: false,
        error: errorMsg,
        status: response.status,
      }
    }
    
    // Check HTTP status
    if (!response.ok) {
      const errorMsg = (data as any)?.error || `请求失败 (${response.status})`
      return {
        ok: false,
        error: errorMsg,
        status: response.status,
        data,
      }
    }
    
    return {
      ok: true,
      data,
      status: response.status,
    }
  } catch (error: any) {
    console.error(`[safeFetch] ${url} network error:`, error)
    
    // Handle common network errors
    let errorMsg = error.message || '网络请求失败'
    if (
      errorMsg.toLowerCase().includes('load failed') ||
      errorMsg.toLowerCase().includes('failed to fetch') ||
      errorMsg.toLowerCase().includes('network') ||
      errorMsg.toLowerCase().includes('abort') ||
      errorMsg.toLowerCase().includes('timeout')
    ) {
      errorMsg = '网络请求失败，请检查网络连接后重试'
    }
    
    return {
      ok: false,
      error: errorMsg,
    }
  }
}

/**
 * Extract meaningful error message from non-JSON response text
 */
function getErrorFromText(text: string, status: number): string {
  // Check for common error patterns
  const lowerText = text.toLowerCase()
  
  if (status === 413) {
    return '请求数据太大，请使用较小的图片'
  }
  
  if (status === 401 || lowerText.includes('unauthorized') || lowerText.includes('请先登录')) {
    return '请先登录'
  }
  
  if (status === 403 || lowerText.includes('forbidden')) {
    return '没有权限访问'
  }
  
  if (status === 404) {
    return '请求的资源不存在'
  }
  
  if (status === 429 || lowerText.includes('rate') || lowerText.includes('limit')) {
    return '请求太频繁，请稍后再试'
  }
  
  if (status >= 500 || lowerText.includes('internal') || lowerText.includes('error')) {
    return '服务器繁忙，请稍后重试'
  }
  
  if (lowerText.includes('resource') || lowerText.includes('busy')) {
    return '资源繁忙，请稍后重试'
  }
  
  // Default error message based on status code
  if (status >= 400 && status < 500) {
    return `请求错误 (${status})`
  }
  
  if (status >= 500) {
    return `服务器错误 (${status})`
  }
  
  return '请求失败，请重试'
}

/**
 * Parse a streaming response, handling errors properly
 * Returns an async generator of parsed events
 */
export async function* parseSSEStream(response: Response): AsyncGenerator<any> {
  if (!response.body) {
    throw new Error('Response has no body')
  }
  
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const jsonStr = line.slice(6).trim()
        if (!jsonStr) continue
        
        try {
          yield JSON.parse(jsonStr)
        } catch (e) {
          console.error('[parseSSEStream] Failed to parse event:', jsonStr.substring(0, 100))
        }
      }
    }
    
    // Process any remaining buffer
    if (buffer) {
      const lines = buffer.split('\n')
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const jsonStr = line.slice(6).trim()
        if (!jsonStr) continue
        
        try {
          yield JSON.parse(jsonStr)
        } catch (e) {
          console.error('[parseSSEStream] Failed to parse event:', jsonStr.substring(0, 100))
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
