import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { validateRedirectServer } from '@/lib/utils/redirect'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  // 验证重定向URL，防止钓鱼攻击
  const redirect = requestUrl.searchParams.get('redirect')
  const next = requestUrl.searchParams.get('next')
  const safeRedirect = validateRedirectServer(next || redirect, requestUrl, '/')
  
  // Handle token hash from email link (Magic Link / OTP link)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as 'email' | 'magiclink' | 'recovery' | 'invite' | null

  if (token_hash && type) {
    const supabase = await createClient()
    
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })

    if (!error) {
      // Successfully verified, redirect to the app
      return NextResponse.redirect(new URL(safeRedirect, requestUrl.origin))
    }
    
    console.error('OTP verification error:', error)
    // Redirect to login with error
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent('验证链接已过期或无效，请重新登录')}`, requestUrl.origin)
    )
  }

  // Handle OAuth code exchange
  if (code) {
    const supabase = await createClient()
    
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(new URL(safeRedirect, requestUrl.origin))
    }
    
    console.error('OAuth code exchange error:', error)
  }

  // Default redirect to login if something went wrong
  return NextResponse.redirect(new URL('/login', requestUrl.origin))
}
