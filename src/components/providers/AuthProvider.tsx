"use client"

import { createContext, useContext, useEffect, useState, useRef } from "react"
import { User, Session } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useAssetStore } from "@/stores/assetStore"

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  isSyncing: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isSyncing: false,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const syncedUserIdRef = useRef<string | null>(null)

  // Get store actions
  const syncWithCloud = useAssetStore(state => state.syncWithCloud)
  const clearUserData = useAssetStore(state => state.clearUserData)
  const setCurrentUserId = useAssetStore(state => state.setCurrentUserId)

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
      
      // Sync data if user is logged in
      if (session?.user && syncedUserIdRef.current !== session.user.id) {
        syncedUserIdRef.current = session.user.id
        setIsSyncing(true)
        try {
          await syncWithCloud(session.user.id)
        } finally {
          setIsSyncing(false)
        }
      }
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)

        if (event === "SIGNED_IN" && session?.user) {
          // Sync cloud data when user signs in
          if (syncedUserIdRef.current !== session.user.id) {
            syncedUserIdRef.current = session.user.id
            setIsSyncing(true)
            try {
              await syncWithCloud(session.user.id)
            } finally {
              setIsSyncing(false)
            }
          }
        } else if (event === "SIGNED_OUT") {
          // Clear user data and reset sync state
          syncedUserIdRef.current = null
          clearUserData()
          router.push("/login")
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router, syncWithCloud, clearUserData, setCurrentUserId])

  const signOut = async () => {
    syncedUserIdRef.current = null
    clearUserData()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isSyncing, signOut }}>
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

