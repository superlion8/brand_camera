"use client"

import { useRef } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, Upload, X, ZoomIn, ArrowRight } from "lucide-react"
import Webcam from "react-webcam"
import { fileToBase64 } from "@/lib/utils"

interface MainProductSectionProps {
  // State
  capturedImage: string | null
  mode: "camera" | "review" | "processing" | "results"
  hasCamera: boolean
  cameraReady: boolean
  permissionChecked: boolean
  isDesktop: boolean
  productFromPhone?: boolean
  // Actions
  onCapture: () => void
  onFileSelect: (base64: string, fromPhone: boolean) => void
  onClear: () => void
  onZoom: (imageUrl: string) => void
  onSelectFromAssets: () => void
  // Camera ref
  webcamRef: React.RefObject<Webcam>
  // Translations
  t: any
  // Optional: change button for review mode
  showChangeButton?: boolean
  onChangeClick?: () => void
}

export function MainProductSection({
  capturedImage,
  mode,
  hasCamera,
  cameraReady,
  permissionChecked,
  isDesktop,
  productFromPhone,
  onCapture,
  onFileSelect,
  onClear,
  onZoom,
  onSelectFromAssets,
  webcamRef,
  t,
  showChangeButton = true,
  onChangeClick,
}: MainProductSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const base64 = await fileToBase64(file)
      onFileSelect(base64, true)
    }
    e.target.value = ""
  }

  // Mobile Camera Mode
  if (!isDesktop && mode === "camera" && !capturedImage) {
    return (
      <div className="flex-1 flex flex-col">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        {/* Camera View */}
        <div className="relative flex-1 bg-black">
          {hasCamera && cameraReady ? (
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "environment" }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
              <div className="text-center text-white">
                <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm opacity-70">
                  {!permissionChecked 
                    ? t.common.loading 
                    : t.camera?.permissionRequired || "Camera permission required"
                  }
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Camera Controls */}
        <div className="absolute bottom-20 left-0 right-0 flex justify-center items-center gap-6 pb-4">
          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30"
          >
            <Upload className="w-6 h-6 text-white" />
          </button>
          
          {/* Capture Button */}
          <button
            onClick={onCapture}
            disabled={!cameraReady}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-xl disabled:opacity-50"
          >
            <div className="w-16 h-16 rounded-full border-4 border-zinc-300" />
          </button>
          
          {/* Assets Button */}
          <button
            onClick={onSelectFromAssets}
            className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30"
          >
            <div className="w-6 h-6 grid grid-cols-2 gap-0.5">
              <div className="w-2.5 h-2.5 bg-white rounded-sm" />
              <div className="w-2.5 h-2.5 bg-white rounded-sm" />
              <div className="w-2.5 h-2.5 bg-white rounded-sm" />
              <div className="w-2.5 h-2.5 bg-white rounded-sm" />
            </div>
          </button>
        </div>
      </div>
    )
  }

  // PC Upload Mode or Mobile Review Mode with image
  if (isDesktop || capturedImage) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-900">
            {t.proStudio?.mainProduct || "Main Product"}
          </h3>
          {showChangeButton && capturedImage && (
            <button
              onClick={onChangeClick || (() => onClear())}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {t.common?.change || "Change"}
            </button>
          )}
        </div>
        
        {capturedImage ? (
          <div 
            className="relative aspect-[3/4] rounded-xl overflow-hidden bg-zinc-100 cursor-pointer group"
            onClick={() => onZoom(capturedImage)}
          >
            <Image
              src={capturedImage}
              alt="Product"
              fill
              className="object-contain"
              unoptimized
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ) : (
          <div
            className="aspect-[3/4] rounded-xl border-2 border-dashed border-zinc-300 hover:border-blue-400 transition-colors flex flex-col items-center justify-center cursor-pointer bg-zinc-50 hover:bg-blue-50/50"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              const file = e.dataTransfer.files?.[0]
              if (file && file.type.startsWith('image/')) {
                const base64 = await fileToBase64(file)
                onFileSelect(base64, true)
              }
            }}
          >
            <Upload className="w-10 h-10 text-zinc-400 mb-2" />
            <span className="text-sm text-zinc-500">
              {t.proStudio?.uploadProduct || "Upload Product"}
            </span>
            <span className="text-xs text-zinc-400 mt-1">
              {t.common?.dragAndDrop || "or drag & drop"}
            </span>
          </div>
        )}
      </div>
    )
  }

  return null
}
