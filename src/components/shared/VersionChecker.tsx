"use client"

import { useVersionCheck } from "@/hooks/useVersionCheck"

// Silent version checker - auto-refreshes on route change when new version detected
export function VersionChecker() {
  // Hook handles everything - no UI needed
  useVersionCheck()
  return null
}

