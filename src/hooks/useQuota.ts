"use client"

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'

interface QuotaInfo {
  totalQuota: number
  usedCount: number
  remainingQuota: number
}

export function useQuota() {
  const { user } = useAuth()
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showExceededModal, setShowExceededModal] = useState(false)
  const [requiredCount, setRequiredCount] = useState<number | undefined>(undefined)

  // Fetch quota on mount and when user changes
  const fetchQuota = useCallback(async () => {
    if (!user) {
      setQuota(null)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/quota')
      if (response.ok) {
        const data = await response.json()
        setQuota(data)
      }
    } catch (error) {
      console.error('Error fetching quota:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchQuota()
  }, [fetchQuota])

  // Check if user has enough quota for the specified number of images
  // Uses local cache first for instant feedback, then verifies with server in background
  const checkQuota = useCallback(async (imageCount: number = 1): Promise<boolean> => {
    if (!user) {
      // Allow generation for non-logged-in users (will be handled elsewhere)
      return true
    }

    // Fast path: Check local cache first (instant, no network delay)
    if (quota) {
      const localRemaining = quota.remainingQuota
      if (localRemaining < imageCount) {
        // Definitely not enough - show modal immediately
        setRequiredCount(imageCount)
        setShowExceededModal(true)
        
        // Refresh quota in background to sync latest data
        fetch('/api/quota').then(res => res.json()).then(data => {
          setQuota({
            totalQuota: data.totalQuota,
            usedCount: data.usedCount,
            remainingQuota: data.remainingQuota,
          })
        }).catch(() => {})
        
        return false
      }
      
      // Local cache says we have enough - proceed immediately
      // Server will do final validation during generation
      // Refresh quota in background (non-blocking)
      fetch('/api/quota').then(res => res.json()).then(data => {
        setQuota({
          totalQuota: data.totalQuota,
          usedCount: data.usedCount,
          remainingQuota: data.remainingQuota,
        })
      }).catch(() => {})
      
      return true
    }

    // No local cache - need to fetch (only happens on first load)
    try {
      const response = await fetch('/api/quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', imageCount }),
      })

      const data = await response.json()
      
      // Update local quota state
      setQuota({
        totalQuota: data.totalQuota,
        usedCount: data.usedCount,
        remainingQuota: data.remainingQuota,
      })
      
      if (!data.hasQuota) {
        setRequiredCount(imageCount)
        setShowExceededModal(true)
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking quota:', error)
      // On error, allow generation to proceed (fail open)
      return true
    }
  }, [user, quota])

  // Refresh quota after generation completes
  // (No longer needs to increment - it's calculated from generations table)
  const refreshQuota = useCallback(async () => {
    await fetchQuota()
  }, [fetchQuota])

  const closeExceededModal = useCallback(() => {
    setShowExceededModal(false)
    setRequiredCount(undefined)
  }, [])

  return {
    quota,
    isLoading,
    showExceededModal,
    requiredCount,
    checkQuota,
    refreshQuota,
    fetchQuota,
    closeExceededModal,
  }
}

