'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Redirect from old /camera/social route to new /social route
export default function SocialRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/social')
  }, [router])
  
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-zinc-400">Redirecting...</div>
    </div>
  )
}
