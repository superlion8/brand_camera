"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'

// Credits 详情
interface CreditsInfo {
  available: number
  daily: number
  subscription: number
  signup: number
  adminGive: number
  purchased: number
  dailyExpired?: boolean
}

// 向后兼容的 QuotaInfo
interface QuotaInfo {
  totalQuota: number
  usedCount: number
  remainingQuota: number
  credits?: CreditsInfo
}

interface DailyRewardResult {
  credited: boolean
  creditsAdded?: number
  isNewUser?: boolean
}

// 可领取状态
interface DailyRewardStatus {
  canClaim: boolean
  alreadyClaimed: boolean
  rewardAmount: number
}

const QUOTA_CACHE_KEY = 'brand_camera_quota_cache_v2'  // 版本号更新
const DAILY_REWARD_CHECK_KEY = 'brand_camera_daily_reward_check'

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

// Check if we already checked daily reward today (to avoid repeated API calls)
function getDailyRewardCheckCache(): DailyRewardStatus | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(DAILY_REWARD_CHECK_KEY)
    if (stored) {
      const { date, status } = JSON.parse(stored)
      const today = new Date().toISOString().split('T')[0]
      if (date === today) {
        return status
      }
    }
  } catch {}
  return null
}

// Cache daily reward check result
function setDailyRewardCheckCache(status: DailyRewardStatus) {
  if (typeof window === 'undefined') return
  try {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(DAILY_REWARD_CHECK_KEY, JSON.stringify({ date: today, status }))
  } catch {}
}

// Clear daily reward check cache (after claiming)
function clearDailyRewardCheckCache() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(DAILY_REWARD_CHECK_KEY)
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
  const [dailyRewardStatus, setDailyRewardStatus] = useState<DailyRewardStatus | null>(() => {
    // Initialize from cache
    return getDailyRewardCheckCache()
  })
  const [isClaimingReward, setIsClaimingReward] = useState(false)
  
  // Track if we've already checked daily reward this session
  const hasCheckedRef = useRef(false)

  // Try to load from cache when user changes
  useEffect(() => {
    if (user?.id) {
      const cached = getCachedQuota(user.id)
      if (cached) {
        setQuota(cached)
      }
      // Also load daily reward status from cache
      const rewardCache = getDailyRewardCheckCache()
      if (rewardCache) {
        setDailyRewardStatus(rewardCache)
      }
    } else {
      setQuota(null)
      setDailyRewardStatus(null)
    }
  }, [user?.id])

  // Check if daily reward is available (called once on first fetch)
  const checkDailyReward = useCallback(async () => {
    if (!user || hasCheckedRef.current) return
    hasCheckedRef.current = true
    
    // Check cache first
    const cached = getDailyRewardCheckCache()
    if (cached) {
      setDailyRewardStatus(cached)
      return
    }
    
    try {
      const response = await fetch('/api/quota/daily-reward', {
        method: 'GET',
      })
      
      if (response.ok) {
        const data = await response.json()
        const status: DailyRewardStatus = {
          canClaim: data.canClaim,
          alreadyClaimed: data.alreadyClaimed,
          rewardAmount: data.rewardAmount || 5,
        }
        setDailyRewardStatus(status)
        setDailyRewardCheckCache(status)
      }
    } catch (error) {
      console.error('Error checking daily reward:', error)
    }
  }, [user])

  // Claim daily reward (called when user clicks the claim button)
  const claimDailyReward = useCallback(async () => {
    if (!user || isClaimingReward) return null
    setIsClaimingReward(true)
    
    try {
      const response = await fetch('/api/quota/daily-reward', {
        method: 'POST',
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Update quota from the response
        const newQuota: QuotaInfo = {
          totalQuota: data.credits?.available || 0,
          usedCount: 0,
          remainingQuota: data.credits?.available || 0,
          credits: data.credits,
        }
        setQuota(newQuota)
        setCachedQuota(user.id, newQuota)
        
        if (data.credited) {
          setDailyReward({
            credited: true,
            creditsAdded: data.creditsAdded,
            isNewUser: data.isNewUser,
          })
          // Update status to already claimed
          const newStatus: DailyRewardStatus = {
            canClaim: false,
            alreadyClaimed: true,
            rewardAmount: data.creditsAdded || 5,
          }
          setDailyRewardStatus(newStatus)
          clearDailyRewardCheckCache()  // Clear cache so next day it will check again
        }
        
        return data
      }
    } catch (error) {
      console.error('Error claiming daily reward:', error)
    } finally {
      setIsClaimingReward(false)
    }
    return null
  }, [user, isClaimingReward])

  // Fetch quota from API and update cache
  const fetchQuota = useCallback(async () => {
    if (!user) {
      setQuota(null)
      return
    }

    setIsLoading(true)
    try {
      // Check if daily reward is available (non-blocking)
      checkDailyReward()
      
      // Fetch quota normally
      const response = await fetch('/api/quota')
      if (response.ok) {
        const data = await response.json()
        const newQuota: QuotaInfo = {
          totalQuota: data.totalQuota,
          usedCount: data.usedCount,
          remainingQuota: data.remainingQuota,
          credits: data.credits,
        }
        setQuota(newQuota)
        setCachedQuota(user.id, newQuota)
      }
    } catch (error) {
      console.error('Error fetching quota:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, checkDailyReward])

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
          const newQuota: QuotaInfo = {
            totalQuota: data.totalQuota,
            usedCount: data.usedCount,
            remainingQuota: data.remainingQuota,
            credits: data.credits,
          }
          setQuota(newQuota)
          if (user) setCachedQuota(user.id, newQuota)
        }).catch(() => {})
        
        return false
      }
      
      // Local cache says we have enough - proceed immediately
      // Refresh quota in background (non-blocking)
      fetch('/api/quota').then(res => res.json()).then(data => {
        const newQuota: QuotaInfo = {
          totalQuota: data.totalQuota,
          usedCount: data.usedCount,
          remainingQuota: data.remainingQuota,
          credits: data.credits,
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
      const newQuota: QuotaInfo = {
        totalQuota: data.totalQuota,
        usedCount: data.usedCount,
        remainingQuota: data.remainingQuota,
        credits: data.credits,
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
        const newQuota: QuotaInfo = {
          totalQuota: data.totalQuota,
          usedCount: data.usedCount,
          remainingQuota: data.remainingQuota,
          credits: data.credits,
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
    dailyRewardStatus,  // 新增：可领取状态
    isClaimingReward,   // 新增：领取中状态
    checkQuota,
    refreshQuota,
    fetchQuota,
    claimDailyReward,   // 新增：手动领取方法
    clearDailyReward,
    // 新增：获取详细的 credits 信息
    credits: quota?.credits,
  }
}
