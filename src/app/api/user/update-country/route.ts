import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - 更新用户的国家信息（通过 Vercel Edge 获取）
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    // 从 Vercel Edge 获取地理位置
    const geo = request.geo
    const country = geo?.country || 'unknown'
    const region = geo?.region || ''
    const city = geo?.city || ''
    
    // 检查用户是否已有国家信息
    const currentCountry = user.user_metadata?.country
    
    // 如果已有国家信息，不覆盖
    if (currentCountry) {
      return NextResponse.json({ 
        success: true, 
        country: currentCountry,
        message: 'Country already set'
      })
    }
    
    // 更新用户的 metadata
    const { error } = await supabase.auth.updateUser({
      data: {
        country,
        region,
        city,
        country_updated_at: new Date().toISOString(),
      }
    })
    
    if (error) {
      console.error('[User] Error updating country:', error)
      return NextResponse.json({ error: 'Failed to update country' }, { status: 500 })
    }
    
    console.log(`[User] Updated country for ${user.email}: ${country}`)
    
    return NextResponse.json({ 
      success: true, 
      country,
      region,
      city,
    })
  } catch (error: any) {
    console.error('[User] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

