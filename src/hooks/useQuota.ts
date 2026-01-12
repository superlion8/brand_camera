"use client"

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import { useQuotaStore, QuotaInfo } from '@/stores/quotaStore'

/**
 * Quota hook - 使用全局 Zustand store
 * 
 * 这个 hook 是 quotaStore 的 wrapper，添加了：
 * 1. 自动根据用户状态初始化
 * 2. checkQuota 方法（需要 router）
 */
export function useQuota() {
  const router = useRouter()
  const { user } = useAuth()
  
  // 从全局 store 获取状态和方法
  const {
    quota,
    isLoading,
    dailyReward,
    dailyRewardStatus,
    isClaimingReward,
    currentUserId,
    initForUser,
    fetchQuota,
    refreshQuota: storeRefreshQuota,
    claimDailyReward: storeClaimDailyReward,
    clearDailyReward,
  } = useQuotaStore()
  
  // 用户变化时初始化 store
  useEffect(() => {
    initForUser(user?.id || null)
  }, [user?.id, initForUser])
  
  // 首次加载时获取 quota（如果还没有）
  useEffect(() => {
    if (user?.id && !quota && currentUserId !== user.id) {
      fetchQuota(user.id)
    }
  }, [user?.id, quota, currentUserId, fetchQuota])
  
  // 包装 refreshQuota，自动传入 userId
  const refreshQuota = useCallback(async () => {
    if (user?.id) {
      await storeRefreshQuota(user.id)
    }
  }, [user?.id, storeRefreshQuota])
  
  // 包装 claimDailyReward，自动传入 userId
  const claimDailyReward = useCallback(async () => {
    if (user?.id) {
      return await storeClaimDailyReward(user.id)
    }
    return null
  }, [user?.id, storeClaimDailyReward])
  
  // 包装 fetchQuota，自动传入 userId
  const fetchQuotaWrapper = useCallback(async () => {
    if (user?.id) {
      await fetchQuota(user.id)
    }
  }, [user?.id, fetchQuota])
  
  // checkQuota 需要 router，所以在 hook 中实现
  const checkQuota = useCallback(async (imageCount: number = 1): Promise<boolean> => {
    if (!user) {
      router.push('/login')
      return false
    }
    
    // Fast path: 先检查本地缓存
    if (quota) {
      if (quota.remainingQuota < imageCount) {
        router.push('/pricing')
        // 后台刷新
        storeRefreshQuota(user.id).catch(() => {})
        return false
      }
      // 本地缓存足够，后台刷新
      storeRefreshQuota(user.id).catch(() => {})
      return true
    }
    
    // 没有本地缓存，需要请求
    try {
      const response = await fetch('/api/quota')
      const data = await response.json()
      
      const newQuota: QuotaInfo = {
        totalQuota: data.totalQuota,
        usedCount: data.usedCount,
        remainingQuota: data.remainingQuota,
        credits: data.credits,
      }
      
      // 更新 store
      useQuotaStore.getState().setQuota(newQuota)
      
      if (newQuota.remainingQuota < imageCount) {
        router.push('/pricing')
        return false
      }
      
      return true
    } catch (error) {
      console.error('Error checking quota:', error)
      return true // fail open
    }
  }, [user, quota, router, storeRefreshQuota])

  return {
    quota,
    isLoading,
    dailyReward,
    dailyRewardStatus,
    isClaimingReward,
    checkQuota,
    refreshQuota,
    fetchQuota: fetchQuotaWrapper,
    claimDailyReward,
    clearDailyReward,
    credits: quota?.credits,
  }
}

// 导出类型
export type { QuotaInfo }
