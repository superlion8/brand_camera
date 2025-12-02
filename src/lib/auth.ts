import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email?: string
}

/**
 * Verify authentication for API routes
 * Supports both Cookie-based auth and Bearer token auth
 * Returns the user if authenticated, null otherwise
 */
export async function getAuthUser(request?: NextRequest): Promise<AuthUser | null> {
  try {
    // Method 1: Check Bearer token in Authorization header
    if (request) {
      const authHeader = request.headers.get('authorization')
      console.log('[Auth] Authorization header:', authHeader ? 'present' : 'missing')
      
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const supabase = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        
        const { data: { user }, error } = await supabase.auth.getUser(token)
        if (!error && user) {
          console.log('[Auth] Bearer token auth success:', user.email)
          return {
            id: user.id,
            email: user.email,
          }
        }
        console.log('[Auth] Bearer token auth failed:', error?.message)
      }
    }
    
    // Method 2: Check Cookie-based session (default for web)
    console.log('[Auth] Checking cookie-based session...')
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      console.log('[Auth] Cookie auth failed:', error?.message || 'No user')
      return null
    }
    
    console.log('[Auth] Cookie auth success:', user.email)
    return {
      id: user.id,
      email: user.email,
    }
  } catch (e) {
    console.error('[Auth] Auth check exception:', e)
    return null
  }
}

/**
 * Helper to return unauthorized response
 */
export function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: '请先登录' },
    { status: 401 }
  )
}

/**
 * Require authentication for API routes
 * Supports both Cookie-based auth and Bearer token auth
 * Returns user if authenticated, or throws unauthorized response
 */
export async function requireAuth(request?: NextRequest): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const user = await getAuthUser(request)
  
  if (!user) {
    return { response: unauthorizedResponse() }
  }
  
  return { user }
}

