'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'

/**
 * Hook for guarding actions that require authentication
 * 
 * Usage:
 * - Call requireLogin() before protected actions
 * - Render LoginModal with showLoginModal state
 * - Use handleLoginSuccess and handleCloseModal as callbacks
 */
export function useLoginGuard() {
  const { user, isLoading } = useAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  /**
   * Check if user is logged in, show login modal if not
   * @returns true if logged in, false if modal was shown
   */
  const requireLogin = useCallback((onSuccess?: () => void): boolean => {
    if (isLoading) return false // Still loading, don't proceed
    
    if (!user) {
      // Save the pending action for after login
      if (onSuccess) {
        setPendingAction(() => onSuccess)
      }
      setShowLoginModal(true)
      return false
    }
    
    return true
  }, [user, isLoading])

  /**
   * Handle successful login - execute pending action if any
   */
  const handleLoginSuccess = useCallback(() => {
    setShowLoginModal(false)
    if (pendingAction) {
      // Small delay to ensure auth state is updated
      setTimeout(() => {
        pendingAction()
        setPendingAction(null)
      }, 100)
    }
  }, [pendingAction])

  /**
   * Close modal and clear pending action
   */
  const handleCloseModal = useCallback(() => {
    setShowLoginModal(false)
    setPendingAction(null)
  }, [])

  return {
    /** Whether user is logged in */
    isLoggedIn: !!user,
    /** Whether auth is still loading */
    isLoading,
    /** Check login and show modal if needed. Returns true if logged in. */
    requireLogin,
    /** Whether login modal should be shown */
    showLoginModal,
    /** Set login modal visibility */
    setShowLoginModal,
    /** Handler for successful login */
    handleLoginSuccess,
    /** Handler for closing modal */
    handleCloseModal,
  }
}
