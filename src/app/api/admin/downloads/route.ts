import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Admin emails from environment variable (comma separated)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Use service role client to bypass RLS for admin queries
  let adminClient
  try {
    adminClient = createServiceClient()
  } catch (error) {
    console.error('[Admin] Service client error:', error)
    adminClient = supabase
  }
  
  const searchParams = request.nextUrl.searchParams
  const dateFrom = searchParams.get('from') || null
  const dateTo = searchParams.get('to') || null
  
  try {
    let query = adminClient
      .from('download_events')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59')
    
    const { data: downloads, error } = await query.limit(500)
    
    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        return NextResponse.json({ 
          downloads: [],
          stats: { total: 0, bySource: {}, byUser: [], recentDownloads: [] },
          message: 'Download tracking table not created yet. Run migration 007_download_events.sql'
        })
      }
      throw error
    }
    
    // Calculate stats
    const stats = {
      total: downloads?.length || 0,
      bySource: {} as Record<string, number>,
      byUser: [] as { email: string; count: number }[],
      recentDownloads: (downloads || []).slice(0, 20).map(d => ({
        id: d.id,
        userEmail: d.user_email || 'anonymous',
        imageUrl: d.image_url,
        source: d.source,
        createdAt: d.created_at,
      })),
    }
    
    // Count by source
    downloads?.forEach(d => {
      stats.bySource[d.source] = (stats.bySource[d.source] || 0) + 1
    })
    
    // Count by user
    const userCounts: Record<string, number> = {}
    downloads?.forEach(d => {
      const email = d.user_email || 'anonymous'
      userCounts[email] = (userCounts[email] || 0) + 1
    })
    stats.byUser = Object.entries(userCounts)
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
    
    return NextResponse.json({ downloads, stats })
  } catch (error: any) {
    console.error('Admin downloads error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

