import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    // Protected routes - redirect to login if not authenticated
    const protectedPaths = ['/camera', '/edit', '/gallery', '/brand-assets', '/studio']
    const isProtectedPath = protectedPaths.some(path => 
      request.nextUrl.pathname.startsWith(path)
    )

    // Always protect these routes - redirect to login if no user
    if (!user && isProtectedPath) {
      // Log for debugging
      if (error) {
        console.warn('[Middleware] Auth error on protected route:', error.message)
      }
      
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }

    // Redirect logged in users away from login page
    if (user && request.nextUrl.pathname === '/login') {
      const redirect = request.nextUrl.searchParams.get('redirect')
      const url = request.nextUrl.clone()
      // Validate redirect URL to prevent open redirect
      if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
        url.pathname = redirect
      } else {
        url.pathname = '/'
      }
      url.searchParams.delete('redirect')
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (e) {
    console.error('[Middleware] Error:', e)
    // On error with protected route, redirect to login
    const protectedPaths = ['/camera', '/edit', '/gallery', '/brand-assets', '/studio']
    const isProtectedPath = protectedPaths.some(path => 
      request.nextUrl.pathname.startsWith(path)
    )
    
    if (isProtectedPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
    
    return supabaseResponse
  }
}

