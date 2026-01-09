"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'

interface QuotaInfo {
  totalQuota: number
  usedCount: number
  remainingQuota: number
}

interface DailyRewardResult {
  credited: boolean
  creditsAdded?: number
  isNewUser?: boolean
}

const QUOTA_CACHE_KEY = 'brand_camera_quota_cache'
const DAILY_REWARD_KEY = 'brand_camera_daily_reward_shown'

// Get cached quota from localStorage
function getCachedQuota(userId: string): QuotaInfo | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = localStorage.getItem(QUOTA_CACHE_KEY)
    if (cached) {
      const { userId: cachedUserId, quota, timestamp } = JSON.parse(cached)
      // Cache valid for 5 minutes
      if (cachedUserId === userId && Date.now() - timestamp < 5 * 60 * 1000) {
        return quota
      }
    }
  } catch {}
  return null
}

// Save quota to localStorage
function setCachedQuota(userId: string, quota: QuotaInfo) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(QUOTA_CACHE_KEY, JSON.stringify({
      userId,
      quota,
      timestamp: Date.now()
    }))
  } catch {}
}

// Check if daily reward toast was shown today
function wasDailyRewardShownToday(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const stored = localStorage.getItem(DAILY_REWARD_KEY)
    if (stored) {
      const { date } = JSON.parse(stored)
      const today = new Date().toISOString().split('T')[0]
      return date === today
    }
  } catch {}
  return false
}

// Mark daily reward toast as shown today
function markDailyRewardShown() {
  if (typeof window === 'undefined') return
  try {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(DAILY_REWARD_KEY, JSON.stringify({ date: today }))
  } catch {}
}

export function useQuota() {
  const router = useRouter()
  const { user } = useAuth()
  
  // Initialize from cache immediately
  const [quota, setQuota] = useState<QuotaInfo | null>(() => {
    if (user?.id) {
      return getCachedQuota(user.id)
    }
    return null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [dailyReward, setDailyReward] = useState<DailyRewardResult | null>(null)
  
  // Track if we've already claimed daily reward this session
  const hasClaimedRef = useRef(false)

  // Try to load from cache when user changes
  useEffect(() => {
    if (user?.id) {
      const cached = getCachedQuota(user.id)
      if (cached) {
        setQuota(cached)
      }
    } else {
      setQuota(null)
    }
  }, [user?.id])

  // Claim daily reward (called once on first fetch)
  const claimDailyReward = useCallback(async () => {
    if (!user || hasClaimedRef.current) return null
    hasClaimedRef.current = true
    
    try {
      const response = await fetch('/api/quota/daily-reward', {
        method: 'POST',
      })
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.credited) {
          // Update quota from the response
          const newQuota = {
            totalQuota: data.totalQuota,
            usedCount: data.usedQuota,
            remainingQuota: data.remainingQuota,
          }
          setQuota(newQuota)
          setCachedQuota(user.id, newQuota)
          
          // Only show toast if not already shown today
          if (!wasDailyRewardShownToday()) {
            setDailyReward({
              credited: true,
              creditsAdded: data.creditsAdded,
              isNewUser: data.isNewUser,
            })
            markDailyRewardShown()
          }
          
          return data
        }
      }
    } catch (error) {
      console.error('Error claiming daily reward:', error)
    }
    return null
  }, [user])

  // Fetch quota from API and update cache
  const fetchQuota = useCallback(async () => {
    if (!user) {
      setQuota(null)
      return
    }

    setIsLoading(true)
    try {
      // First, try to claim daily reward (will also return updated quota)
      const rewardResult = await claimDailyReward()
      
      // If reward was claimed, quota is already updated
      if (rewardResult?.credited) {
        setIsLoading(false)
        return
      }
      
      // Otherwise, fetch quota normally
      const response = await fetch('/api/quota')
      if (response.ok) {
        const data = await response.json()
        const newQuota = {
          totalQuota: data.totalQuota,
          usedCount: data.usedCount,
          remainingQuota: data.remainingQuota,
        }
        setQuota(newQuota)
        setCachedQuota(user.id, newQuota)
      }
    } catch (error) {
      console.error('Error fetching quota:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, claimDailyReward])

  // Fetch on mount only if no cache
  useEffect(() => {
    if (user && !quota) {
      fetchQuota()
    }
  }, [user, quota, fetchQuota])

  // Check if user has enough quota for the specified number of images
  // Redirects to /pricing if insufficient
  const checkQuota = useCallback(async (imageCount: number = 1): Promise<boolean> => {
    if (!user) {
      // Redirect to login for non-logged-in users
      router.push('/login')
      return false
    }

    // Fast path: Check local cache first (instant, no network delay)
    if (quota) {
      const localRemaining = quota.remainingQuota
      if (localRemaining < imageCount) {
        // Not enough credits - redirect to pricing page
        router.push('/pricing')
        
        // Refresh quota in background to sync latest data
        fetch('/api/quota').then(res => res.json()).then(data => {
          const newQuota = {
            totalQuota: data.totalQuota,
            usedCount: data.usedCount,
            remainingQuota: data.remainingQuota,
          }
          setQuota(newQuota)
          if (user) setCachedQuota(user.id, newQuota)
        }).catch(() => {})
        
        return false
      }
      
      // Local cache says we have enough - proceed immediately
      // Refresh quota in background (non-blocking)
      fetch('/api/quota').then(res => res.json()).then(data => {
        const newQuota = {
          totalQuota: data.totalQuota,
          usedCount: data.usedCount,
          remainingQuota: data.remainingQuota,
        }
        setQuota(newQuota)
        if (user) setCachedQuota(user.id, newQuota)
      }).catch(() => {})
      
      return true
    }

    // No local cache - need to fetch (only happens on first load)
    try {
      const response = await fetch('/api/quota')
      const data = await response.json()
      
      // Update local quota state
      const newQuota = {
        totalQuota: data.totalQuota,
        usedCount: data.usedCount,
        remainingQuota: data.remainingQuota,
      }
      setQuota(newQuota)
      if (user) setCachedQuota(user.id, newQuota)
      
      if (newQuota.remainingQuota < imageCount) {
        router.push('/pricing')
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking quota:', error)
      // On error, allow generation to proceed (fail open)
      return true
    }
  }, [user, quota, router])

  // Refresh quota after generation completes
  const refreshQuota = useCallback(async () => {
    if (!user) return
    
    try {
      const response = await fetch('/api/quota')
      if (response.ok) {
        const data = await response.json()
        const newQuota = {
          totalQuota: data.totalQuota,
          usedCount: data.usedCount,
          remainingQuota: data.remainingQuota,
        }
        setQuota(newQuota)
        setCachedQuota(user.id, newQuota)
      }
    } catch (error) {
      console.error('Error refreshing quota:', error)
    }
  }, [user])

  // Clear daily reward notification (after toast is dismissed)
  const clearDailyReward = useCallback(() => {
    setDailyReward(null)
  }, [])

  return {
    quota,
    isLoading,
    dailyReward,
    checkQuota,
    refreshQuota,
    fetchQuota,
    clearDailyReward,
  }
}
