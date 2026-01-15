import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const DAILY_REWARD_AMOUNT = 5 // 每日奖励额度

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
export interface QuotaInfo {
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

interface QuotaState {
  // 状态
  quota: QuotaInfo | null
  isLoading: boolean
  dailyReward: DailyRewardResult | null
  dailyRewardStatus: DailyRewardStatus | null
  isClaimingReward: boolean
  
  // 当前用户 ID（用于判断缓存是否有效）
  currentUserId: string | null
  
  // 是否已检查过每日奖励
  hasCheckedDailyReward: boolean
  
  // Actions
  setQuota: (quota: QuotaInfo | null) => void
  setIsLoading: (loading: boolean) => void
  setDailyReward: (reward: DailyRewardResult | null) => void
  setDailyRewardStatus: (status: DailyRewardStatus | null) => void
  setIsClaimingReward: (claiming: boolean) => void
  
  // 用户切换时重置
  initForUser: (userId: string | null) => void
  
  // 从 API 获取 quota
  fetchQuota: (userId: string) => Promise<void>
  
  // 刷新 quota（生成后调用）
  refreshQuota: (userId: string) => Promise<void>
  
  // 检查每日奖励状态
  checkDailyReward: (userId: string) => Promise<void>
  
  // 领取每日奖励
  claimDailyReward: (userId: string) => Promise<DailyRewardResult | null>
  
  // 清除每日奖励通知
  clearDailyReward: () => void
}

const DAILY_REWARD_CHECK_KEY = 'brand_camera_daily_reward_check'

// Check if we already checked daily reward today
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

// Clear daily reward check cache
function clearDailyRewardCheckCache() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(DAILY_REWARD_CHECK_KEY)
  } catch {}
}

export const useQuotaStore = create<QuotaState>()(
  persist(
    (set, get) => ({
      // 初始状态
      quota: null,
      isLoading: false,
      dailyReward: null,
      dailyRewardStatus: null,
      isClaimingReward: false,
      currentUserId: null,
      hasCheckedDailyReward: false,
      
      // Setters
      setQuota: (quota) => set({ quota }),
      setIsLoading: (isLoading) => set({ isLoading }),
      setDailyReward: (dailyReward) => set({ dailyReward }),
      setDailyRewardStatus: (dailyRewardStatus) => set({ dailyRewardStatus }),
      setIsClaimingReward: (isClaimingReward) => set({ isClaimingReward }),
      
      // 用户切换时初始化
      initForUser: (userId) => {
        const state = get()
        
        // 如果是同一个用户，不需要重置
        if (state.currentUserId === userId) return
        
        // 用户变化，重置状态
        if (!userId) {
          set({
            quota: null,
            dailyReward: null,
            dailyRewardStatus: null,
            currentUserId: null,
            hasCheckedDailyReward: false,
          })
        } else {
          // 新用户，尝试从缓存加载每日奖励状态
          const cachedDailyReward = getDailyRewardCheckCache()
          set({
            currentUserId: userId,
            dailyRewardStatus: cachedDailyReward,
            hasCheckedDailyReward: false,
          })
        }
      },
      
      // 从 API 获取 quota
      fetchQuota: async (userId) => {
        if (!userId) {
          set({ quota: null })
          return
        }
        
        set({ isLoading: true })
        try {
          // 同时检查每日奖励（非阻塞）
          get().checkDailyReward(userId)
          
          const response = await fetch('/api/quota')
          if (response.ok) {
            const data = await response.json()
            const newQuota: QuotaInfo = {
              totalQuota: data.totalQuota,
              usedCount: data.usedCount,
              remainingQuota: data.remainingQuota,
              credits: data.credits,
            }
            set({ quota: newQuota, currentUserId: userId })
          }
        } catch (error) {
          console.error('Error fetching quota:', error)
        } finally {
          set({ isLoading: false })
        }
      },
      
      // 刷新 quota
      refreshQuota: async (userId) => {
        if (!userId) return
        
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
            set({ quota: newQuota })
          }
        } catch (error) {
          console.error('Error refreshing quota:', error)
        }
      },
      
      // 检查每日奖励状态
      checkDailyReward: async (userId) => {
        if (!userId || get().hasCheckedDailyReward) return
        
        set({ hasCheckedDailyReward: true })
        
        // 先检查缓存
        const cached = getDailyRewardCheckCache()
        if (cached) {
          set({ dailyRewardStatus: cached })
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
            set({ dailyRewardStatus: status })
            setDailyRewardCheckCache(status)
          }
        } catch (error) {
          console.error('Error checking daily reward:', error)
        }
      },
      
      // 领取每日奖励
      claimDailyReward: async (userId) => {
        if (!userId || get().isClaimingReward) return null
        
        set({ isClaimingReward: true })
        
        try {
          const response = await fetch('/api/quota/daily-reward', {
            method: 'POST',
          })
          
          if (response.ok) {
            const data = await response.json()
            
            // 更新 quota
            const newQuota: QuotaInfo = {
              totalQuota: data.credits?.available || 0,
              usedCount: 0,
              remainingQuota: data.credits?.available || 0,
              credits: data.credits,
            }
            set({ quota: newQuota })
            
            if (data.credited) {
              // 成功领取
              const reward: DailyRewardResult = {
                credited: true,
                creditsAdded: data.creditsAdded,
                isNewUser: data.isNewUser,
              }
              set({ dailyReward: reward })
              
              // 更新状态为已领取
              const newStatus: DailyRewardStatus = {
                canClaim: false,
                alreadyClaimed: true,
                rewardAmount: data.creditsAdded || 5,
              }
              set({ dailyRewardStatus: newStatus })
              clearDailyRewardCheckCache()
              
              return reward
            } else {
              // 今天已经领取过了 - 也要更新状态！
              const newStatus: DailyRewardStatus = {
                canClaim: false,
                alreadyClaimed: true,
                rewardAmount: DAILY_REWARD_AMOUNT,
              }
              set({ dailyRewardStatus: newStatus })
              setDailyRewardCheckCache(newStatus)
              return null
            }
          }
        } catch (error) {
          console.error('Error claiming daily reward:', error)
        } finally {
          set({ isClaimingReward: false })
        }
        return null
      },
      
      // 清除每日奖励通知
      clearDailyReward: () => set({ dailyReward: null }),
    }),
    {
      name: 'quota-storage',
      storage: createJSONStorage(() => localStorage),
      // 只持久化 quota 和 currentUserId
      partialize: (state) => ({
        quota: state.quota,
        currentUserId: state.currentUserId,
      }),
    }
  )
)
