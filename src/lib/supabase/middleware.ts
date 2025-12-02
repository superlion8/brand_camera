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

    // If there's an error getting user, don't block - let client handle it
    if (error) {
      console.warn('[Middleware] Auth error:', error.message)
      return supabaseResponse
    }

    // Protected routes - redirect to login if not authenticated
    // Only redirect for initial page loads, not for client-side navigation
    const protectedPaths = ['/camera', '/edit', '/gallery', '/brand-assets', '/studio']
    const isProtectedPath = protectedPaths.some(path => 
      request.nextUrl.pathname.startsWith(path)
    )

    // Check if this is an initial load or client navigation
    // Client navigation typically has a Referer header from the same origin
    const referer = request.headers.get('referer')
    const isClientNavigation = referer && referer.includes(request.nextUrl.origin)

    if (!user && isProtectedPath && !isClientNavigation) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }

    // Redirect logged in users away from login page
    if (user && request.nextUrl.pathname === '/login') {
      const redirect = request.nextUrl.searchParams.get('redirect')
      const url = request.nextUrl.clone()
      url.pathname = redirect && redirect.startsWith('/') ? redirect : '/'
      url.searchParams.delete('redirect')
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (e) {
    console.error('[Middleware] Error:', e)
    // On error, don't block - let the page load and handle auth client-side
    return supabaseResponse
  }
}

