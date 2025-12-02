/**
 * 验证重定向URL是否安全
 * 防止开放重定向攻击 (Open Redirect Vulnerability)
 * 
 * 安全的重定向URL:
 * - 相对路径: /camera, /edit, /gallery 等
 * - 同源URL: https://your-domain.com/path
 * 
 * 不安全的重定向URL (会被拒绝):
 * - 外部URL: https://evil-site.com
 * - 协议相对URL: //evil-site.com
 * - javascript: 协议
 * - data: 协议
 */

/**
 * 检查 URL 是否为安全的相对路径
 */
function isSafeRelativePath(path: string): boolean {
  // 必须以单个 / 开头，但不能是 // (协议相对URL)
  if (!path.startsWith('/') || path.startsWith('//')) {
    return false
  }
  
  // 检查是否包含协议
  if (path.includes(':')) {
    return false
  }
  
  // 检查是否有换行符或其他特殊字符（防止 header injection）
  if (/[\r\n\t]/.test(path)) {
    return false
  }
  
  return true
}

/**
 * 检查 URL 是否为同源
 */
function isSameOrigin(url: string, origin: string): boolean {
  try {
    const parsedUrl = new URL(url, origin)
    const parsedOrigin = new URL(origin)
    return parsedUrl.origin === parsedOrigin.origin
  } catch {
    return false
  }
}

/**
 * 验证重定向URL并返回安全的URL
 * 
 * @param redirect - 用户提供的重定向URL
 * @param origin - 当前站点的 origin (如 https://example.com)
 * @param defaultPath - 如果验证失败，返回的默认路径
 * @returns 安全的重定向路径
 */
export function validateRedirectUrl(
  redirect: string | null | undefined,
  origin: string,
  defaultPath: string = '/'
): string {
  // 如果没有提供 redirect，返回默认路径
  if (!redirect) {
    return defaultPath
  }
  
  // 去除首尾空格
  const trimmed = redirect.trim()
  
  // 空字符串返回默认路径
  if (!trimmed) {
    return defaultPath
  }
  
  // 检查是否为安全的相对路径
  if (isSafeRelativePath(trimmed)) {
    return trimmed
  }
  
  // 检查是否为同源绝对URL
  if (isSameOrigin(trimmed, origin)) {
    try {
      // 提取路径部分
      const url = new URL(trimmed, origin)
      return url.pathname + url.search + url.hash
    } catch {
      return defaultPath
    }
  }
  
  // 不安全的URL，返回默认路径
  console.warn(`[Security] Blocked unsafe redirect URL: ${trimmed}`)
  return defaultPath
}

/**
 * 在服务端验证重定向URL (用于 API routes)
 */
export function validateRedirectServer(
  redirect: string | null | undefined,
  requestUrl: URL,
  defaultPath: string = '/'
): string {
  return validateRedirectUrl(redirect, requestUrl.origin, defaultPath)
}

/**
 * 在客户端验证重定向URL
 */
export function validateRedirectClient(
  redirect: string | null | undefined,
  defaultPath: string = '/'
): string {
  if (typeof window === 'undefined') {
    return defaultPath
  }
  return validateRedirectUrl(redirect, window.location.origin, defaultPath)
}

