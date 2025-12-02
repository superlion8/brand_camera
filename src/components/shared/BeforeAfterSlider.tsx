"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Image from "next/image"

interface BeforeAfterSliderProps {
  beforeImage: string
  afterImage: string
  className?: string
  height?: number
  autoPlay?: boolean
  autoPlayDuration?: number // Duration for one complete cycle in ms
  pauseDuration?: number // Pause at end before restarting
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  className = "",
  height = 200,
  autoPlay = true,
  autoPlayDuration = 4500, // Time to go from 0% to 100%
  pauseDuration = 1000, // Pause at 100% before jumping back to 0%
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const isPausedRef = useRef(false)
  const lastTimeRef = useRef<number | null>(null)
  const currentPositionRef = useRef(0)

  const animate = useCallback((timestamp: number) => {
    if (isPausedRef.current) {
      lastTimeRef.current = null
      animationRef.current = requestAnimationFrame(animate)
      return
    }

    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp
    }
    
    const deltaTime = timestamp - lastTimeRef.current
    lastTimeRef.current = timestamp
    
    // Calculate speed: move from 0% to 100% over autoPlayDuration
    const speed = 100 / autoPlayDuration // percent per ms
    
    let newPosition = currentPositionRef.current + speed * deltaTime
    
    if (newPosition >= 100) {
      newPosition = 100
      setPosition(100)
      currentPositionRef.current = 100
      
      // Pause at end, then jump back to start
      isPausedRef.current = true
      setTimeout(() => {
        currentPositionRef.current = 0
        setPosition(0)
        isPausedRef.current = false
      }, pauseDuration)
    } else {
      currentPositionRef.current = newPosition
      setPosition(newPosition)
    }
    
    if (autoPlay) {
      animationRef.current = requestAnimationFrame(animate)
    }
  }, [autoPlay, autoPlayDuration, pauseDuration])

  // Start auto-play
  useEffect(() => {
    if (autoPlay) {
      lastTimeRef.current = null
      currentPositionRef.current = 0
      setPosition(0)
      animationRef.current = requestAnimationFrame(animate)
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [autoPlay, animate])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${className || 'rounded-2xl'}`}
      style={{ height }}
    >
      {/* After Image (Background - full image) */}
      <div className="absolute inset-0">
        <Image
          src={afterImage}
          alt="After"
          fill
          className="object-cover"
          draggable={false}
        />
      </div>

      {/* Before Image (Clipped from left - shows on right side) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      >
        <Image
          src={beforeImage}
          alt="Before"
          fill
          className="object-cover"
          draggable={false}
        />
      </div>
    </div>
  )
}
