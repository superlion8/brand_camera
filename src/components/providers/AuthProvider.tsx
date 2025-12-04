"use client"

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react"
import { User, Session } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { useRouter, usePathname } from "next/navigation"

interface AuthContextType {
  user: User | null
  session: Session | null
  accessToken: string | null
  isLoading: boolean
  isSyncing: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
  promptLogin: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  accessToken: null,
  isLoading: true,
  isSyncing: false,
  isAuthenticated: false,
  signOut: async () => {},
  promptLogin: () => {},
})

// Protected routes that require authentication
const PROTECTED_ROUTES = ['/camera', '/edit', '/gallery', '/brand-assets', '/studio']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const syncedUserIdRef = useRef<string | null>(null)

  const accessToken = session?.access_token ?? null
  const isAuthenticated = Boolean(session && accessToken)

  // Redirect to login with current path
  const promptLogin = useCallback(() => {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/'
    router.push(`/login?redirect=${encodeURIComponent(currentPath)}`)
  }, [router])

  // Sync with cloud - import store dynamically to avoid hydration issues
  // Add timeout to prevent infinite sync state
  const syncWithCloud = useCallback(async (userId: string) => {
    const SYNC_TIMEOUT = 15000 // 15 seconds max
    
    try {
      const { useAssetStore } = await import("@/stores/assetStore")
      const store = useAssetStore.getState()
      
      // IMPORTANT: Always set currentUserId first, before any async operations
      // This ensures operations can sync even if the full sync fails
      store.setCurrentUserId(userId)
      console.log("[Auth] Set currentUserId:", userId)
      
      // Race between sync and timeout
      await Promise.race([
        store.syncWithCloud(userId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sync timeout')), SYNC_TIMEOUT)
        )
      ])
    } catch (error) {
      console.error("[Auth] Sync error:", error)
      // Ensure store isSyncing is also reset on timeout, but keep currentUserId
      try {
        const { useAssetStore } = await import("@/stores/assetStore")
        useAssetStore.setState({ isSyncing: false })
      } catch {}
    }
  }, [])

  // Clear user data and reset Supabase client
  const clearUserData = useCallback(async () => {
    try {
      // Reset Supabase client to clear any cached auth state
      const { resetSupabaseClient } = await import("@/lib/supabase/syncService")
      resetSupabaseClient()
      
      const { useAssetStore } = require("@/stores/assetStore")
      const store = useAssetStore.getState()
      store.clearUserData()
    } catch (error) {
      console.error("[Auth] Clear data error:", error)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    // Get initial session
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!isMounted) return
        
        if (error) {
          console.error("[Auth] Get session error:", error.message)
        }
        
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)
        
        // Sync data if user is logged in
        if (session?.user && syncedUserIdRef.current !== session.user.id) {
          syncedUserIdRef.current = session.user.id
          setIsSyncing(true)
          try {
            await syncWithCloud(session.user.id)
            // 更新用户国家信息（静默，不阻塞）
            fetch('/api/user/update-country', { method: 'POST' }).catch(() => {})
          } finally {
            if (isMounted) setIsSyncing(false)
          }
        }
      } catch (error) {
        console.error("[Auth] Get session error:", error)
        if (isMounted) setIsLoading(false)
      }
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return
        
        setSession(newSession)
        setUser(newSession?.user ?? null)
        setIsLoading(false)

        if (event === "SIGNED_IN" && newSession?.user) {
          // Sync cloud data when user signs in
          if (syncedUserIdRef.current !== newSession.user.id) {
            syncedUserIdRef.current = newSession.user.id
            setIsSyncing(true)
            try {
              await syncWithCloud(newSession.user.id)
            } finally {
              if (isMounted) setIsSyncing(false)
            }
          }
        } else if (event === "SIGNED_OUT") {
          // Clear user data and reset sync state
          syncedUserIdRef.current = null
          clearUserData()
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase, syncWithCloud, clearUserData])

  // Client-side route protection
  useEffect(() => {
    if (isLoading) return // Wait for auth to load
    
    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname?.startsWith(route))
    
    if (!isAuthenticated && isProtectedRoute) {
      // Redirect to login with return path
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`)
    }
  }, [isLoading, isAuthenticated, pathname, router])

  const signOut = useCallback(async () => {
    syncedUserIdRef.current = null
    clearUserData()
    await supabase.auth.signOut()
    router.push("/login")
  }, [supabase, router, clearUserData])

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      accessToken,
      isLoading, 
      isSyncing, 
      isAuthenticated,
      signOut,
      promptLogin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

