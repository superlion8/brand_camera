"use client"

import { useCallback } from 'react'
import { useQuota } from './useQuota'

interface ReserveOptions {
  taskId: string
  imageCount: number
  taskType: string
}

interface ReserveResult {
  success: boolean
  reservationId?: string
  error?: string
}

/**
 * useQuotaReservation - 统一的配额预扣/退款 hook
 * 
 * 封装所有配额操作，自动刷新 UI，避免遗漏 refreshQuota 调用
 * 
 * 使用示例:
 * ```
 * const { reserveQuota, refundQuota, partialRefund, confirmQuota } = useQuotaReservation()
 * 
 * // 预扣配额
 * const result = await reserveQuota({ taskId, imageCount: 4, taskType: 'pro_studio' })
 * if (!result.success) return
 * 
 * // 生成失败时退款
 * await refundQuota(taskId)
 * 
 * // 部分成功时退还差额
 * await partialRefund(taskId, actualSuccessCount)
 * 
 * // 生成成功时刷新 UI
 * await confirmQuota()
 * ```
 */
export function useQuotaReservation() {
  const { refreshQuota } = useQuota()

  /**
   * 预扣配额
   * - 调用 POST /api/quota/reserve
   * - 自动刷新 UI
   */
  const reserveQuota = useCallback(async (options: ReserveOptions): Promise<ReserveResult> => {
    const { taskId, imageCount, taskType } = options
    
    try {
      const res = await fetch('/api/quota/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, imageCount, taskType }),
      })
      
      // 无论成功失败，都刷新 UI 显示最新配额
      refreshQuota()
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[QuotaReservation] Reserve failed:', data)
        return { 
          success: false, 
          error: data.error || 'Failed to reserve quota' 
        }
      }
      
      const data = await res.json()
      console.log('[QuotaReservation] Reserved', imageCount, 'credits for task', taskId)
      
      return { 
        success: true, 
        reservationId: data.reservationId 
      }
    } catch (e: any) {
      console.error('[QuotaReservation] Reserve error:', e)
      refreshQuota() // 即使出错也刷新 UI
      return { 
        success: false, 
        error: e.message || 'Network error' 
      }
    }
  }, [refreshQuota])

  /**
   * 完全退款（任务取消或全部失败）
   * - 调用 DELETE /api/quota/reserve?taskId=xxx
   * - 自动刷新 UI
   */
  const refundQuota = useCallback(async (taskId: string): Promise<void> => {
    try {
      await fetch(`/api/quota/reserve?taskId=${taskId}`, { method: 'DELETE' })
      console.log('[QuotaReservation] Refunded quota for task', taskId)
    } catch (e) {
      console.warn('[QuotaReservation] Refund failed:', e)
    }
    // 无论成功失败，都刷新 UI
    refreshQuota()
  }, [refreshQuota])

  /**
   * 部分退款（部分失败）
   * - 调用 PUT /api/quota/reserve
   * - 自动计算并退还差额
   * - 自动刷新 UI
   */
  const partialRefund = useCallback(async (
    taskId: string, 
    actualSuccessCount: number
  ): Promise<void> => {
    try {
      await fetch('/api/quota/reserve', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, actualImageCount: actualSuccessCount }),
      })
      console.log('[QuotaReservation] Partial refund for task', taskId, 'actual:', actualSuccessCount)
    } catch (e) {
      console.warn('[QuotaReservation] Partial refund failed:', e)
    }
    // 无论成功失败，都刷新 UI
    refreshQuota()
  }, [refreshQuota])

  /**
   * 确认配额（生成成功，不需要退款）
   * - 只刷新 UI 显示最新配额
   */
  const confirmQuota = useCallback(async (): Promise<void> => {
    await refreshQuota()
  }, [refreshQuota])

  return {
    reserveQuota,
    refundQuota,
    partialRefund,
    confirmQuota,
  }
}
