"use client"

import { useState, useRef, useCallback } from "react"
import Webcam from "react-webcam"
import { Camera, Upload, Home, Users } from "lucide-react"
import { useCameraStore } from "@/stores/cameraStore"
import { useRouter } from "next/navigation"
import { fileToBase64 } from "@/lib/utils"
import { ModelStyle } from "@/types"

const modeLabels: { value: ModelStyle; label: string }[] = [
  { value: "auto", label: "智能" },
  { value: "japanese", label: "日系" },
  { value: "korean", label: "韩系" },
  { value: "chinese", label: "中式" },
  { value: "western", label: "欧美" },
]

export default function CameraPage() {
  const router = useRouter()
  const webcamRef = useRef<Webcam>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")
  const [isCapturing, setIsCapturing] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [hasCamera, setHasCamera] = useState(true)
  
  const { setCapturedImage, modelStyle, setModelStyle } = useCameraStore()
  
  const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode,
  }
  
  const handleCapture = useCallback(() => {
    if (webcamRef.current && !isCapturing) {
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
  }, [setCapturedImage, router, isCapturing])
  
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      setCapturedImage(base64)
      router.push("/camera/preview")
    }
  }, [setCapturedImage, router])

  const handleCameraError = useCallback(() => {
    setHasCamera(false)
  }, [])
  
  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      {/* Camera viewport */}
      {hasCamera ? (
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          screenshotQuality={0.95}
          videoConstraints={videoConstraints}
          onUserMediaError={handleCameraError}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-surface-solid rounded-2xl p-8 max-w-xs w-full mx-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 opacity-30">
              <Camera className="w-full h-full text-white" />
            </div>
            <p className="text-white/60 mb-2">相机不可用</p>
            <p className="text-white/40 text-sm">请使用下方上传按钮</p>
          </div>
        </div>
      )}
      
      {/* Flash effect */}
      {showFlash && (
        <div className="absolute inset-0 bg-white shutter-flash z-10" />
      )}
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 glass-dark pb-4">
        <div className="pt-safe px-4 pt-4">
          <button
            onClick={() => router.push("/gallery")}
            className="w-10 h-10 rounded-full glass flex items-center justify-center active:scale-90 transition-transform"
          >
            <Home className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
      
      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 glass-dark pt-8 pb-safe">
        {/* Mode Selector */}
        <div className="flex justify-center mb-6">
          <div className="glass rounded-full p-1 inline-flex gap-1">
            {modeLabels.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setModelStyle(mode.value)}
                className={`mode-button ${
                  modelStyle === mode.value
                    ? "mode-button-active"
                    : "mode-button-inactive"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-6 px-8 pb-4">
          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 rounded-xl glass flex items-center justify-center active:scale-90 transition-transform"
          >
            <Upload className="w-6 h-6 text-white" />
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          
          {/* Capture Button */}
          <button
            onClick={handleCapture}
            disabled={!hasCamera || isCapturing}
            className={`capture-button ${(!hasCamera || isCapturing) ? "opacity-50" : ""}`}
          >
            <div className={modelStyle !== "auto" ? "capture-button-ring-yellow" : "capture-button-ring"} />
            <div className={modelStyle !== "auto" ? "capture-button-inner-yellow" : "capture-button-inner"}>
              <Camera className="w-8 h-8 text-black" />
            </div>
          </button>
          
          {/* Model Select Button (placeholder) */}
          <button
            onClick={() => router.push("/brand-assets")}
            className="w-12 h-12 rounded-xl glass flex items-center justify-center active:scale-90 transition-transform"
          >
            <Users className="w-6 h-6 text-white" />
          </button>
        </div>
        
        {/* Selected Mode Indicator */}
        {modelStyle !== "auto" && (
          <div className="flex justify-center pb-2">
            <div className="badge badge-yellow flex items-center gap-2">
              <span>风格: {modeLabels.find(m => m.value === modelStyle)?.label}</span>
              <button
                onClick={() => setModelStyle("auto")}
                className="hover:opacity-70"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
