import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      // Redirect to the specified page after successful verification
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
    
    console.error('Email confirmation error:', error)
  }

  // Redirect to login with error message
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent('验证链接已过期或无效，请重新登录')}`, requestUrl.origin)
  )
}

