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
      return false
    }

    try {
      const response = await fetch('/api/quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', imageCount }),
      })

      const data = await response.json()
      
      if (!data.hasQuota) {
        setQuota({
          totalQuota: data.totalQuota,
          usedCount: data.usedCount,
          remainingQuota: data.remainingQuota,
        })
        setShowExceededModal(true)
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking quota:', error)
      return false
    }
  }, [user])

  // Increment used count after successful generation
  const incrementQuota = useCallback(async (imageCount: number = 1): Promise<boolean> => {
    if (!user) {
      return false
    }

    try {
      const response = await fetch('/api/quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'increment', imageCount }),
      })

      const data = await response.json()
      
      if (response.ok && data.success) {
        setQuota({
          totalQuota: data.totalQuota,
          usedCount: data.usedCount,
          remainingQuota: data.remainingQuota,
        })
        return true
      }

      if (!data.hasQuota) {
        setShowExceededModal(true)
      }

      return false
    } catch (error) {
      console.error('Error incrementing quota:', error)
      return false
    }
  }, [user])

  const closeExceededModal = useCallback(() => {
    setShowExceededModal(false)
  }, [])

  return {
    quota,
    isLoading,
    showExceededModal,
    checkQuota,
    incrementQuota,
    fetchQuota,
    closeExceededModal,
  }
}

