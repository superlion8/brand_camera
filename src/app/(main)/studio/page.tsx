'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Redirect from old /studio route to new /product-shot route
export default function StudioRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/product-shot')
  }, [router])
  
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-zinc-400">Redirecting...</div>
    </div>
  )
}
