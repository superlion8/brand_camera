"use client"

import { useState, useRef, useCallback } from "react"
import Webcam from "react-webcam"
import { Camera, Upload, RotateCcw, FlipHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCameraStore } from "@/stores/cameraStore"
import { useRouter } from "next/navigation"
import { fileToBase64 } from "@/lib/utils"

export default function CameraPage() {
  const router = useRouter()
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [isCapturing, setIsCapturing] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  
  const { setCapturedImage } = useCameraStore()
  
  const videoConstraints = {
    width: { ideal: 1080 },
    height: { ideal: 1440 },
    facingMode,
  }
  
  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      setShowFlash(true)
      setIsCapturing(true)
      
      setTimeout(() => {
        const imageSrc = webcamRef.current?.getScreenshot()
        if (imageSrc) {
          setCapturedImage(imageSrc)
          router.push("/camera/preview")
        }
        setIsCapturing(false)
        setShowFlash(false)
      }, 100)
    }
  }, [setCapturedImage, router])
  
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setCapturedImage(base64)
      router.push("/camera/preview")
    }
  }, [setCapturedImage, router])
  
  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === "user" ? "environment" : "user")
  }, [])
  
  return (
    <div className="relative h-screen bg-black flex flex-col">
      {/* Camera viewport */}
      <div className="flex-1 relative overflow-hidden">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.9}
          videoConstraints={videoConstraints}
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Flash effect */}
        {showFlash && (
          <div className="absolute inset-0 bg-white shutter-flash z-10" />
        )}
        
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-full h-full grid grid-cols-3 grid-rows-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="border border-white/10" />
            ))}
          </div>
        </div>
        
        {/* Aspect ratio guide */}
        <div className="absolute inset-4 border-2 border-white/20 rounded-lg pointer-events-none" />
      </div>
      
      {/* Bottom controls */}
      <div className="relative bg-[#0D0D0D] px-6 py-8 pb-safe">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-xs">上传</span>
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          
          {/* Capture button */}
          <button
            onClick={handleCapture}
            disabled={isCapturing}
            className="relative group"
          >
            <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-95">
              <div className="w-16 h-16 rounded-full bg-white group-hover:bg-gray-100 transition-colors" />
            </div>
            {isCapturing && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-accent border-t-transparent animate-spin" />
              </div>
            )}
          </button>
          
          {/* Switch camera button */}
          <button
            onClick={toggleCamera}
            className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
              <FlipHorizontal className="w-5 h-5" />
            </div>
            <span className="text-xs">切换</span>
          </button>
        </div>
      </div>
    </div>
  )
}

