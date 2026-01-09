'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Redirect from old /camera route to new /buyer-show route
export default function CameraRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/buyer-show')
  }, [router])
  
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-zinc-400">Redirecting...</div>
    </div>
  )
}
