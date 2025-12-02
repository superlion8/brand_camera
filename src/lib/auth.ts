import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface AuthUser {
  id: string
  email?: string
}

/**
 * Verify authentication for API routes
 * Returns the user if authenticated, null otherwise
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }
    
    return {
      id: user.id,
      email: user.email,
    }
  } catch (e) {
    console.error('Auth check failed:', e)
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
 * Returns user if authenticated, or throws unauthorized response
 */
export async function requireAuth(): Promise<{ user: AuthUser } | { response: NextResponse }> {
  const user = await getAuthUser()
  
  if (!user) {
    return { response: unauthorizedResponse() }
  }
  
  return { user }
}

