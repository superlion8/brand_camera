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
    // Fallback to regular client if service key not configured
    adminClient = supabase
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
      let genQuery = adminClient
        .from('generations')
        .select('id, user_id, user_email, task_type, total_images_count, created_at')
        .order('created_at', { ascending: false })
      
      // Apply date filters
      if (dateFrom) genQuery = genQuery.gte('created_at', dateFrom)
      if (dateTo) genQuery = genQuery.lte('created_at', dateTo + 'T23:59:59')
      
      const { data: generations, error: genError } = await genQuery
      if (genError) throw genError
      
      console.log('[Admin] Overview - generations fetched:', generations?.length || 0)
      
      let favQuery = adminClient
        .from('favorites')
        .select('id, user_id, created_at')
      
      if (dateFrom) favQuery = favQuery.gte('created_at', dateFrom)
      if (dateTo) favQuery = favQuery.lte('created_at', dateTo + 'T23:59:59')
      
      const { data: favorites, error: favError } = await favQuery
      if (favError) throw favError
      
      // Get download events
      let downloadQuery = adminClient
        .from('download_events')
        .select('id, user_id, created_at')
      
      if (dateFrom) downloadQuery = downloadQuery.gte('created_at', dateFrom)
      if (dateTo) downloadQuery = downloadQuery.lte('created_at', dateTo + 'T23:59:59')
      
      const { data: downloads } = await downloadQuery
      
      // Group by date
      const dailyStats: Record<string, {
        date: string
        uniqueUsers: Set<string>
        tasks: number
        images: number
        favorites: number
        downloads: number
      }> = {}
      
      generations?.forEach(gen => {
        const date = gen.created_at.split('T')[0]
        if (!dailyStats[date]) {
          dailyStats[date] = { date, uniqueUsers: new Set(), tasks: 0, images: 0, favorites: 0, downloads: 0 }
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
      
      downloads?.forEach(dl => {
        const date = dl.created_at.split('T')[0]
        if (!dailyStats[date]) {
          dailyStats[date] = { date, uniqueUsers: new Set(), tasks: 0, images: 0, favorites: 0, downloads: 0 }
        }
        dailyStats[date].downloads++
      })
      
      const overview = Object.values(dailyStats)
        .map(d => ({
          date: d.date,
          uniqueUsers: d.uniqueUsers.size,
          tasks: d.tasks,
          images: d.images,
          favorites: d.favorites,
          downloads: d.downloads,
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30) // Last 30 days
      
      // Totals
      const totals = {
        totalUsers: new Set(generations?.map(g => g.user_id) || []).size,
        totalTasks: generations?.length || 0,
        totalImages: generations?.reduce((sum, g) => sum + (g.total_images_count || 0), 0) || 0,
        totalFavorites: favorites?.length || 0,
        totalDownloads: downloads?.length || 0,
      }
      
      return NextResponse.json({ overview, totals })
    }
    
    if (view === 'by-type') {
      // Statistics by task type
      let genQuery = adminClient
        .from('generations')
        .select('id, user_id, task_type, total_images_count, created_at')
      
      if (dateFrom) genQuery = genQuery.gte('created_at', dateFrom)
      if (dateTo) genQuery = genQuery.lte('created_at', dateTo + 'T23:59:59')
      
      const { data: generations, error } = await genQuery
      if (error) throw error
      
      console.log('[Admin] By-type - generations fetched:', generations?.length || 0)
      
      // Get generation IDs for favorites query
      const genIds = generations?.map(g => g.id) || []
      let favorites: { id: string; generation_id: string }[] = []
      
      if (genIds.length > 0) {
        const { data: favData } = await adminClient
          .from('favorites')
          .select('id, generation_id')
          .in('generation_id', genIds)
        favorites = favData || []
      }
      
      // Get downloads with generation_id to map to task type
      let downloadQuery = adminClient
        .from('download_events')
        .select('id, generation_id')
      
      if (dateFrom) downloadQuery = downloadQuery.gte('created_at', dateFrom)
      if (dateTo) downloadQuery = downloadQuery.lte('created_at', dateTo + 'T23:59:59')
      
      const { data: downloads } = await downloadQuery
      
      // Create a map of generation_id to task_type
      const genIdToType: Record<string, string> = {}
      generations?.forEach(g => {
        genIdToType[g.id] = g.task_type || 'unknown'
      })
      
      // Count downloads by task type using generation_id
      const downloadCountByGen: Record<string, number> = {}
      downloads?.forEach(d => {
        if (d.generation_id) {
          downloadCountByGen[d.generation_id] = (downloadCountByGen[d.generation_id] || 0) + 1
        }
      })
      
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
        downloads: number
      }> = {}
      
      generations?.forEach(gen => {
        const type = gen.task_type || 'unknown'
        if (!byType[type]) {
          byType[type] = { type, uniqueUsers: new Set(), tasks: 0, images: 0, favorites: 0, downloads: 0 }
        }
        byType[type].uniqueUsers.add(gen.user_id)
        byType[type].tasks++
        byType[type].images += gen.total_images_count || 0
        byType[type].favorites += favCountByGen[gen.id] || 0
        byType[type].downloads += downloadCountByGen[gen.id] || 0
      })
      
      const totalDownloads = downloads?.length || 0
      
      const result = Object.values(byType).map(d => ({
        type: d.type,
        uniqueUsers: d.uniqueUsers.size,
        tasks: d.tasks,
        images: d.images,
        favorites: d.favorites,
        downloads: d.downloads,
      }))
      
      return NextResponse.json({ byType: result, totalDownloads })
    }
    
    if (view === 'by-user') {
      // Statistics by user
      let genQuery = adminClient
        .from('generations')
        .select('id, user_id, user_email, task_type, total_images_count, created_at')
      
      if (dateFrom) genQuery = genQuery.gte('created_at', dateFrom)
      if (dateTo) genQuery = genQuery.lte('created_at', dateTo + 'T23:59:59')
      
      const { data: generations, error } = await genQuery
      if (error) throw error
      
      console.log('[Admin] By-user - generations fetched:', generations?.length || 0)
      
      // Get generation IDs for favorites query
      const genIds = generations?.map(g => g.id) || []
      let favorites: { id: string; user_id: string; generation_id: string }[] = []
      
      if (genIds.length > 0) {
        const { data: favData } = await adminClient
          .from('favorites')
          .select('id, user_id, generation_id')
          .in('generation_id', genIds)
        favorites = favData || []
      }
      
      // Get downloads by user and generation
      let downloadQuery = adminClient
        .from('download_events')
        .select('id, user_id, generation_id')
      
      if (dateFrom) downloadQuery = downloadQuery.gte('created_at', dateFrom)
      if (dateTo) downloadQuery = downloadQuery.lte('created_at', dateTo + 'T23:59:59')
      
      const { data: downloads } = await downloadQuery
      
      // Create download count by user
      const downloadCountByUser: Record<string, number> = {}
      // Create download count by generation (for byType breakdown)
      const downloadCountByGen: Record<string, number> = {}
      downloads?.forEach(d => {
        if (d.user_id) {
          downloadCountByUser[d.user_id] = (downloadCountByUser[d.user_id] || 0) + 1
        }
        if (d.generation_id) {
          downloadCountByGen[d.generation_id] = (downloadCountByGen[d.generation_id] || 0) + 1
        }
      })
      
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
        totalDownloads: number
        byType: Record<string, { tasks: number; images: number; favorites: number; downloads: number }>
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
            totalDownloads: downloadCountByUser[gen.user_id] || 0,
            byType: {},
          }
        }
        byUser[gen.user_id].totalTasks++
        byUser[gen.user_id].totalImages += gen.total_images_count || 0
        
        const type = gen.task_type || 'unknown'
        if (!byUser[gen.user_id].byType[type]) {
          byUser[gen.user_id].byType[type] = { tasks: 0, images: 0, favorites: 0, downloads: 0 }
        }
        byUser[gen.user_id].byType[type].tasks++
        byUser[gen.user_id].byType[type].images += gen.total_images_count || 0
        byUser[gen.user_id].byType[type].favorites += favCountByGen[gen.id] || 0
        byUser[gen.user_id].byType[type].downloads += downloadCountByGen[gen.id] || 0
      })
      
      const result = Object.values(byUser).sort((a, b) => b.totalTasks - a.totalTasks)
      
      return NextResponse.json({ byUser: result })
    }
    
    if (view === 'details') {
      // Task details with filters
      let query = adminClient
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
        query = query.lte('created_at', dateTo + 'T23:59:59')
      }
      
      const { data: generations, error } = await query
      if (error) throw error
      
      console.log('[Admin] Details - generations fetched:', generations?.length || 0)
      
      // Get favorites for these generations
      const genIds = generations?.map(g => g.id) || []
      let favByGen: Record<string, number[]> = {}
      let downloadsByGen: Record<string, number[]> = {}
      
      if (genIds.length > 0) {
        const { data: favorites } = await adminClient
          .from('favorites')
          .select('generation_id, image_index')
          .in('generation_id', genIds)
        
        favorites?.forEach(f => {
          if (!favByGen[f.generation_id]) favByGen[f.generation_id] = []
          favByGen[f.generation_id].push(f.image_index)
        })
        
        // Get downloads for these generations
        const { data: downloads } = await adminClient
          .from('download_events')
          .select('generation_id, image_index')
          .in('generation_id', genIds)
        
        downloads?.forEach(d => {
          if (d.generation_id) {
            if (!downloadsByGen[d.generation_id]) downloadsByGen[d.generation_id] = []
            if (d.image_index !== null) downloadsByGen[d.generation_id].push(d.image_index)
          }
        })
      }
      
      const details = generations?.map(gen => {
        // Handle output images from different sources
        let outputUrls: string[] = gen.output_image_urls || []
        
        // If output_image_urls is empty, try output_images (JSONB)
        if (outputUrls.length === 0 && gen.output_images) {
          if (Array.isArray(gen.output_images)) {
            outputUrls = gen.output_images.map((img: any) => 
              typeof img === 'string' ? img : img.url || img.image_url || ''
            ).filter(Boolean)
          }
        }
        
        // Try to get input image from various sources
        const inputParams = gen.input_params || {}
        const inputUrl = gen.input_image_url || inputParams.inputImage || inputParams.productImageUrl || ''
        const modelUrl = gen.model_image_url || inputParams.modelImage || inputParams.modelImageUrl || ''
        const bgUrl = gen.background_image_url || inputParams.backgroundImage || inputParams.backgroundImageUrl || ''
        
        return {
          id: gen.id,
          taskId: gen.task_id,
          userEmail: gen.user_email || gen.user_id,
          taskType: gen.task_type,
          status: gen.status,
          inputImageUrl: inputUrl,
          inputImage2Url: gen.input_image2_url || inputParams.inputImage2 || inputParams.productImage2Url || '',
          modelImageUrl: modelUrl,
          backgroundImageUrl: bgUrl,
          outputImageUrls: outputUrls,
          totalImages: gen.total_images_count || outputUrls.length || 0,
          simpleCount: gen.simple_mode_count || 0,
          extendedCount: gen.extended_mode_count || 0,
          favoritedIndices: favByGen[gen.id] || [],
          downloadedIndices: downloadsByGen[gen.id] || [],
          createdAt: gen.created_at,
          // Include raw params for debugging
          inputParams: inputParams,
        }
      })?.filter(d => d.inputImageUrl || d.outputImageUrls.length > 0) // Filter out empty tasks
      
      return NextResponse.json({ details })
    }
    
    return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
  } catch (error: any) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

