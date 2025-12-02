"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Image from "next/image"

interface BeforeAfterSliderProps {
  beforeImage: string
  afterImage: string
  className?: string
  height?: number
  autoPlay?: boolean
  autoPlayDuration?: number // Duration for one direction in ms
  pauseDuration?: number // Pause at each end in ms
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  className = "",
  height = 200,
  autoPlay = true,
  autoPlayDuration = 4500, // 3x slower (was 1500 per direction)
  pauseDuration = 1000, // 1 second pause at ends
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const animationRef = useRef<number | null>(null)
  const directionRef = useRef<'forward' | 'backward'>('forward')
  const isPausedRef = useRef(false)
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const currentPositionRef = useRef(50)

  const animate = useCallback((timestamp: number) => {
    if (isPausedRef.current) {
      animationRef.current = requestAnimationFrame(animate)
      return
    }

    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp
    }
    
    const deltaTime = timestamp - lastTimeRef.current
    lastTimeRef.current = timestamp
    
    // Calculate speed: move from 15% to 85% over autoPlayDuration
    const range = 70 // 85 - 15
    const speed = range / autoPlayDuration // percent per ms
    
    let newPosition = currentPositionRef.current
    
    if (directionRef.current === 'forward') {
      newPosition += speed * deltaTime
      if (newPosition >= 85) {
        newPosition = 85
        directionRef.current = 'backward'
        isPausedRef.current = true
        // Pause at right end
        setTimeout(() => {
          isPausedRef.current = false
        }, pauseDuration)
      }
    } else {
      newPosition -= speed * deltaTime
      if (newPosition <= 15) {
        newPosition = 15
        directionRef.current = 'forward'
        isPausedRef.current = true
        // Pause at left end
        setTimeout(() => {
          isPausedRef.current = false
        }, pauseDuration)
      }
    }
    
    currentPositionRef.current = newPosition
    setSliderPosition(newPosition)
    
    if (isAutoPlaying && !isDragging.current) {
      animationRef.current = requestAnimationFrame(animate)
    }
  }, [isAutoPlaying, autoPlayDuration, pauseDuration])

  // Start/stop auto-play
  useEffect(() => {
    if (isAutoPlaying && !isDragging.current) {
      lastTimeRef.current = null
      animationRef.current = requestAnimationFrame(animate)
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isAutoPlaying, animate])

  const stopAutoPlay = useCallback(() => {
    setIsAutoPlaying(false)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current)
    }
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current)
    }
  }, [])

  const resumeAutoPlay = useCallback(() => {
    if (autoPlay) {
      // Resume after 3 seconds of inactivity
      resumeTimeoutRef.current = setTimeout(() => {
        lastTimeRef.current = null
        currentPositionRef.current = sliderPosition
        // Determine direction based on current position
        directionRef.current = sliderPosition > 50 ? 'backward' : 'forward'
        setIsAutoPlaying(true)
      }, 3000)
    }
  }, [autoPlay, sliderPosition])

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPosition(percentage)
    currentPositionRef.current = percentage
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    stopAutoPlay()
    handleMove(e.clientX)
  }, [handleMove, stopAutoPlay])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    handleMove(e.clientX)
  }, [handleMove])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    resumeAutoPlay()
  }, [resumeAutoPlay])

  const handleMouseLeave = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false
      resumeAutoPlay()
    }
  }, [resumeAutoPlay])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true
    stopAutoPlay()
    handleMove(e.touches[0].clientX)
  }, [handleMove, stopAutoPlay])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return
    handleMove(e.touches[0].clientX)
  }, [handleMove])

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
    resumeAutoPlay()
  }, [resumeAutoPlay])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current)
      }
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none cursor-ew-resize ${className || 'rounded-2xl'}`}
      style={{ height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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

      {/* Before Image (Clipped from right - shows on left side of slider) */}
      {/* clipPath inset(top right bottom left) - we clip from right by (100-position)% */}
      {/* When slider at 85% (right), clip 15% from right = show 85% of Before on left */}
      {/* When slider at 15% (left), clip 85% from right = show 15% of Before on left */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <Image
          src={beforeImage}
          alt="Before"
          fill
          className="object-cover"
          draggable={false}
        />
      </div>

      {/* Slider Handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
      >
        {/* Handle Circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center">
          <div className="flex items-center gap-0.5">
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-r-[4px] border-r-zinc-400" />
            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[4px] border-l-zinc-400" />
          </div>
        </div>
      </div>
    </div>
  )
}
