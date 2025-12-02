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
  const checkQuota = useCallback(async (imageCount: number = 1): Promise<boolean> => {
    if (!user) {
      // Allow generation for non-logged-in users (will be handled elsewhere)
      return true
    }

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
        setShowExceededModal(true)
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking quota:', error)
      // On error, allow generation to proceed (fail open)
      return true
    }
  }, [user])

  // Refresh quota after generation completes
  // (No longer needs to increment - it's calculated from generations table)
  const refreshQuota = useCallback(async () => {
    await fetchQuota()
  }, [fetchQuota])

  const closeExceededModal = useCallback(() => {
    setShowExceededModal(false)
  }, [])

  return {
    quota,
    isLoading,
    showExceededModal,
    checkQuota,
    refreshQuota, // Renamed from incrementQuota
    fetchQuota,
    closeExceededModal,
  }
}

