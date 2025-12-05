"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, Sparkles } from "lucide-react"
import { create } from "zustand"

// Store for triggering the fly animation
interface FlyAnimationState {
  isFlying: boolean
  startPosition: { x: number; y: number } | null
  triggerFly: (startX: number, startY: number) => void
  endFly: () => void
}

export const useFlyAnimationStore = create<FlyAnimationState>((set) => ({
  isFlying: false,
  startPosition: null,
  triggerFly: (x, y) => set({ isFlying: true, startPosition: { x, y } }),
  endFly: () => set({ isFlying: false, startPosition: null }),
}))

// Helper function to trigger fly animation from anywhere
export function triggerFlyToGallery(event?: React.MouseEvent | { clientX: number; clientY: number }) {
  const { triggerFly } = useFlyAnimationStore.getState()
  
  if (event) {
    triggerFly(event.clientX, event.clientY)
  } else {
    // Default to center of screen if no event
    triggerFly(window.innerWidth / 2, window.innerHeight / 2)
  }
}

export function FlyToGallery() {
  const { isFlying, startPosition, endFly } = useFlyAnimationStore()
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    // Calculate gallery icon position (rightmost tab in bottom nav)
    // Gallery is the 5th tab, bottom nav has 5 columns
    const updateTarget = () => {
      const screenWidth = window.innerWidth
      const maxWidth = Math.min(screenWidth, 512) // max-w-lg = 512px
      const navLeft = (screenWidth - maxWidth) / 2
      const columnWidth = maxWidth / 5
      // Gallery is the 5th column (index 4), center of that column
      const targetX = navLeft + columnWidth * 4.5
      const targetY = window.innerHeight - 40 // Bottom nav is 64px, icon is around 40px from bottom
      setTargetPosition({ x: targetX, y: targetY })
    }
    
    updateTarget()
    window.addEventListener('resize', updateTarget)
    return () => window.removeEventListener('resize', updateTarget)
  }, [])

  if (!startPosition) return null

  return (
    <AnimatePresence>
      {isFlying && (
        <>
          {/* Flying image icon */}
          <motion.div
            initial={{ 
              x: startPosition.x - 20, 
              y: startPosition.y - 20,
              scale: 1,
              opacity: 1,
            }}
            animate={{ 
              x: targetPosition.x - 20, 
              y: targetPosition.y - 20,
              scale: 0.5,
              opacity: 0.8,
            }}
            exit={{ 
              scale: 0,
              opacity: 0,
            }}
            transition={{ 
              duration: 0.8,
              ease: [0.32, 0.72, 0, 1], // Custom easing for natural arc
            }}
            onAnimationComplete={endFly}
            className="fixed z-[100] pointer-events-none"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </motion.div>

          {/* Sparkle trail */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: startPosition.x - 8, 
                y: startPosition.y - 8,
                scale: 0,
                opacity: 0,
              }}
              animate={{ 
                x: startPosition.x + (targetPosition.x - startPosition.x) * ((i + 1) / 6) - 8, 
                y: startPosition.y + (targetPosition.y - startPosition.y) * ((i + 1) / 6) - 20 - Math.sin((i + 1) / 6 * Math.PI) * 30, // Arc path
                scale: [0, 1, 0],
                opacity: [0, 0.8, 0],
              }}
              transition={{ 
                duration: 0.6,
                delay: i * 0.08,
                ease: "easeOut",
              }}
              className="fixed z-[99] pointer-events-none"
            >
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </motion.div>
          ))}

          {/* Target pulse effect */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0, 0.5, 0] }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="fixed z-[98] pointer-events-none"
            style={{ 
              left: targetPosition.x - 24, 
              top: targetPosition.y - 24,
            }}
          >
            <div className="w-12 h-12 rounded-full bg-purple-500/30" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

