'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Redirect from old /camera/group route to new /group-shot route
export default function GroupRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/group-shot')
  }, [router])
  
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-zinc-400">Redirecting...</div>
    </div>
  )
}
