"use client"

import { cn } from "@/lib/utils"
import { ModelStyle } from "@/types"

const styles: { value: ModelStyle; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "korean", label: "Korean" },
  { value: "western", label: "Western" },
]

interface StyleSelectorProps {
  value: ModelStyle
  onChange: (style: ModelStyle) => void
}

export function StyleSelector({ value, onChange }: StyleSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
      {styles.map((style) => (
        <button
          key={style.value}
          onClick={() => onChange(style.value)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
            value === style.value
              ? "bg-gradient-to-r from-accent to-accent-light text-primary"
              : "bg-surface border border-border text-gray-400 hover:text-white hover:border-border-light"
          )}
        >
          {style.label}
        </button>
      ))}
    </div>
  )
}

