"use client"

import { useState, useRef, useCallback } from "react"
import Webcam from "react-webcam"
import { Camera, Upload, Image as ImageIcon, Aperture } from "lucide-react"
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
  const [hasCamera, setHasCamera] = useState(true)
  
  const { setCapturedImage } = useCameraStore()
  
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
    <div className="h-screen w-full bg-black flex flex-col overflow-hidden">
      {/* Camera Viewport */}
      <div className="flex-1 relative">
        {hasCamera ? (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            screenshotQuality={0.95}
            videoConstraints={videoConstraints}
            onUserMediaError={handleCameraError}
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <div className="text-center text-zinc-400">
              <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">相机不可用</p>
              <p className="text-xs mt-1">请使用下方上传按钮</p>
            </div>
          </div>
        )}
        
        {/* Flash effect */}
        {showFlash && (
          <div className="absolute inset-0 bg-white shutter-flash z-10" />
        )}
        
        {/* Grid Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="w-full h-full grid grid-cols-3 grid-rows-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="border border-white/20" />
            ))}
          </div>
        </div>
        
        {/* Viewfinder Frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 border border-white/50 rounded-lg relative">
            {/* Corner brackets */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-white" />
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-white" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-white" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-white" />
          </div>
        </div>
        
        {/* Top Title */}
        <div className="absolute top-8 left-0 right-0 text-center text-white/80 text-sm font-medium px-4 drop-shadow-md">
          拍摄您的商品
        </div>
      </div>
      
      {/* Bottom Controls */}
      <div className="h-32 bg-black/90 flex items-center justify-around px-8 pb-6 shrink-0">
        {/* Album / Upload Button */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <ImageIcon className="w-5 h-5" />
          </div>
          <span className="text-[10px]">相册</span>
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
          className={`w-[72px] h-[72px] rounded-full border-4 border-white/30 flex items-center justify-center relative group active:scale-95 transition-transform ${(!hasCamera || isCapturing) ? "opacity-50" : ""}`}
        >
          <div className="w-16 h-16 bg-white rounded-full group-active:bg-gray-200 transition-colors border-2 border-black" />
        </button>
        
        {/* Settings Button */}
        <div className="w-10 flex flex-col items-center gap-1 text-white/40">
          <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center border border-white/20">
            <Aperture className="w-5 h-5" />
          </div>
          <span className="text-[10px]">设置</span>
        </div>
      </div>
    </div>
  )
}
