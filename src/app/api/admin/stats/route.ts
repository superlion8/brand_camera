import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Admin emails from environment variable (comma separated)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const searchParams = request.nextUrl.searchParams
  const view = searchParams.get('view') || 'overview' // overview, by-type, by-user, details
  const filterType = searchParams.get('type') || null
  const filterEmail = searchParams.get('email') || null
  const dateFrom = searchParams.get('from') || null
  const dateTo = searchParams.get('to') || null
  
  try {
    if (view === 'overview') {
      // Daily overview statistics
      const { data: generations, error: genError } = await supabase
        .from('generations')
        .select('id, user_id, task_type, total_images_count, created_at')
        .order('created_at', { ascending: false })
      
      if (genError) throw genError
      
      const { data: favorites, error: favError } = await supabase
        .from('favorites')
        .select('id, user_id, created_at')
      
      if (favError) throw favError
      
      // Get user emails
      const userIds = [...new Set(generations?.map(g => g.user_id) || [])]
      const { data: users } = await supabase
        .from('auth.users')
        .select('id, email')
      
      // Group by date
      const dailyStats: Record<string, {
        date: string
        uniqueUsers: Set<string>
        tasks: number
        images: number
        favorites: number
      }> = {}
      
      generations?.forEach(gen => {
        const date = gen.created_at.split('T')[0]
        if (!dailyStats[date]) {
          dailyStats[date] = { date, uniqueUsers: new Set(), tasks: 0, images: 0, favorites: 0 }
        }
        dailyStats[date].uniqueUsers.add(gen.user_id)
        dailyStats[date].tasks++
        dailyStats[date].images += gen.total_images_count || 0
      })
      
      favorites?.forEach(fav => {
        const date = fav.created_at.split('T')[0]
        if (dailyStats[date]) {
          dailyStats[date].favorites++
        }
      })
      
      const overview = Object.values(dailyStats)
        .map(d => ({
          date: d.date,
          uniqueUsers: d.uniqueUsers.size,
          tasks: d.tasks,
          images: d.images,
          favorites: d.favorites,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30) // Last 30 days
      
      // Totals
      const totals = {
        totalUsers: new Set(generations?.map(g => g.user_id) || []).size,
        totalTasks: generations?.length || 0,
        totalImages: generations?.reduce((sum, g) => sum + (g.total_images_count || 0), 0) || 0,
        totalFavorites: favorites?.length || 0,
      }
      
      return NextResponse.json({ overview, totals })
    }
    
    if (view === 'by-type') {
      // Statistics by task type
      const { data: generations, error } = await supabase
        .from('generations')
        .select('id, user_id, task_type, total_images_count')
      
      if (error) throw error
      
      const { data: favorites } = await supabase
        .from('favorites')
        .select('id, generation_id')
      
      // Create a map of generation_id to favorite count
      const favCountByGen: Record<string, number> = {}
      favorites?.forEach(f => {
        favCountByGen[f.generation_id] = (favCountByGen[f.generation_id] || 0) + 1
      })
      
      const byType: Record<string, {
        type: string
        uniqueUsers: Set<string>
        tasks: number
        images: number
        favorites: number
      }> = {}
      
      generations?.forEach(gen => {
        const type = gen.task_type || 'unknown'
        if (!byType[type]) {
          byType[type] = { type, uniqueUsers: new Set(), tasks: 0, images: 0, favorites: 0 }
        }
        byType[type].uniqueUsers.add(gen.user_id)
        byType[type].tasks++
        byType[type].images += gen.total_images_count || 0
        byType[type].favorites += favCountByGen[gen.id] || 0
      })
      
      const result = Object.values(byType).map(d => ({
        type: d.type,
        uniqueUsers: d.uniqueUsers.size,
        tasks: d.tasks,
        images: d.images,
        favorites: d.favorites,
      }))
      
      return NextResponse.json({ byType: result })
    }
    
    if (view === 'by-user') {
      // Statistics by user
      const { data: generations, error } = await supabase
        .from('generations')
        .select('id, user_id, user_email, task_type, total_images_count')
      
      if (error) throw error
      
      const { data: favorites } = await supabase
        .from('favorites')
        .select('id, user_id, generation_id')
      
      // Create maps
      const favCountByGen: Record<string, number> = {}
      const favCountByUser: Record<string, number> = {}
      favorites?.forEach(f => {
        favCountByGen[f.generation_id] = (favCountByGen[f.generation_id] || 0) + 1
        favCountByUser[f.user_id] = (favCountByUser[f.user_id] || 0) + 1
      })
      
      const byUser: Record<string, {
        email: string
        userId: string
        totalTasks: number
        totalImages: number
        totalFavorites: number
        byType: Record<string, { tasks: number; images: number; favorites: number }>
      }> = {}
      
      generations?.forEach(gen => {
        const email = gen.user_email || gen.user_id
        if (!byUser[gen.user_id]) {
          byUser[gen.user_id] = {
            email,
            userId: gen.user_id,
            totalTasks: 0,
            totalImages: 0,
            totalFavorites: favCountByUser[gen.user_id] || 0,
            byType: {},
          }
        }
        byUser[gen.user_id].totalTasks++
        byUser[gen.user_id].totalImages += gen.total_images_count || 0
        
        const type = gen.task_type || 'unknown'
        if (!byUser[gen.user_id].byType[type]) {
          byUser[gen.user_id].byType[type] = { tasks: 0, images: 0, favorites: 0 }
        }
        byUser[gen.user_id].byType[type].tasks++
        byUser[gen.user_id].byType[type].images += gen.total_images_count || 0
        byUser[gen.user_id].byType[type].favorites += favCountByGen[gen.id] || 0
      })
      
      const result = Object.values(byUser).sort((a, b) => b.totalTasks - a.totalTasks)
      
      return NextResponse.json({ byUser: result })
    }
    
    if (view === 'details') {
      // Task details with filters
      let query = supabase
        .from('generations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (filterType) {
        query = query.eq('task_type', filterType)
      }
      if (filterEmail) {
        query = query.ilike('user_email', `%${filterEmail}%`)
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo)
      }
      
      const { data: generations, error } = await query
      if (error) throw error
      
      // Get favorites for these generations
      const genIds = generations?.map(g => g.id) || []
      const { data: favorites } = await supabase
        .from('favorites')
        .select('generation_id, image_index')
        .in('generation_id', genIds)
      
      const favByGen: Record<string, number[]> = {}
      favorites?.forEach(f => {
        if (!favByGen[f.generation_id]) favByGen[f.generation_id] = []
        favByGen[f.generation_id].push(f.image_index)
      })
      
      const details = generations?.map(gen => ({
        id: gen.id,
        taskId: gen.task_id,
        userEmail: gen.user_email || gen.user_id,
        taskType: gen.task_type,
        status: gen.status,
        inputImageUrl: gen.input_image_url,
        inputImage2Url: gen.input_image2_url,
        modelImageUrl: gen.model_image_url,
        backgroundImageUrl: gen.background_image_url,
        outputImageUrls: gen.output_image_urls || [],
        totalImages: gen.total_images_count || 0,
        simpleCount: gen.simple_mode_count || 0,
        extendedCount: gen.extended_mode_count || 0,
        favoritedIndices: favByGen[gen.id] || [],
        createdAt: gen.created_at,
      }))
      
      return NextResponse.json({ details })
    }
    
    return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
  } catch (error: any) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

