"use client"

import { Sparkles, Loader2 } from "lucide-react"
import { CreditCostBadge } from "@/components/shared/CreditCostBadge"

interface GenerateButtonProps {
  // State
  isEnabled: boolean
  isProcessing: boolean
  creditCost: number
  // Actions
  onClick: () => void
  // Translations
  t: any
  // Optional styling
  className?: string
  // Button text override
  buttonText?: string
}

export function GenerateButton({
  isEnabled,
  isProcessing,
  creditCost,
  onClick,
  t,
  className = "",
  buttonText,
}: GenerateButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={!isEnabled || isProcessing}
      className={`w-full h-14 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
        isEnabled && !isProcessing
          ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/30"
          : "bg-zinc-300 cursor-not-allowed"
      } ${className}`}
    >
      {isProcessing ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          {t.common?.processing || "Processing..."}
        </>
      ) : (
        <>
          <Sparkles className="w-5 h-5" />
          {buttonText || t.proStudio?.startGenerate || "Start Generate"}
          <CreditCostBadge cost={creditCost} />
        </>
      )}
    </button>
  )
}
