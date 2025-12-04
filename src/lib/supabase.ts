import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if environment variables are properly configured
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

// Use placeholder values to prevent crash during development without env vars
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

// Server-side client with service role
export const getServiceClient = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey || !supabaseUrl) {
    console.error('[Supabase] Service role key or URL not configured')
    throw new Error('Service role key not configured')
  }
  return createClient(supabaseUrl, serviceKey)
}

