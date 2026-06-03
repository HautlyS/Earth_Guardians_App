/**
 * List Projects Edge Function
 * Earth Guardians Platform
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, successResponse, validateAuth, getPaginationParams } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error: authError, user } = await validateAuth(supabase, req)
    if (authError || !user) {
      return errorResponse(authError || 'Unauthorized', 401)
    }

    const url = new URL(req.url)
    const { limit, offset } = getPaginationParams(url)
    const crew_id = url.searchParams.get('crew_id')
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')

    // Build query
    let query = supabase
      .from('projects')
      .select(`
        *,
        creator:profiles!created_by(id, username, display_name, avatar_url),
        crew:crews(id, name, slug),
        tasks(count)
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (crew_id) {
      query = query.eq('crew_id', crew_id)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Filter by user's access (crew membership or own projects)
    const { data: userCrews } = await supabase
      .from('crew_members')
      .select('crew_id')
      .eq('user_id', user.id)

    const crewIds = userCrews?.map(c => c.crew_id) || []
    
    if (crewIds.length > 0) {
      query = query.or(`crew_id.in.(${crewIds.join(',')}),created_by.eq.${user.id}`)
    } else {
      query = query.eq('created_by', user.id)
    }

    const { data: projects, error: fetchError, count } = await query

    if (fetchError) throw fetchError

    // Get task stats for each project
    const projectIds = projects?.map(p => p.id) || []
    const { data: taskStats } = await supabase
      .from('tasks')
      .select('project_id, status')
      .in('project_id', projectIds)
      .is('deleted_at', null)

    // Group task stats by project
    const tasksByProject = new Map<string, { total: number; done: number }>()
    for (const task of taskStats || []) {
      const existing = tasksByProject.get(task.project_id) || { total: 0, done: 0 }
      existing.total++
      if (task.status === 'done') existing.done++
      tasksByProject.set(task.project_id, existing)
    }

    // Enrich projects with task stats
    const enrichedProjects = projects?.map(project => ({
      ...project,
      task_stats: tasksByProject.get(project.id) || { total: 0, done: 0 }
    })) || []

    return successResponse({
      projects: enrichedProjects,
      total: count || 0,
      limit,
      offset
    })

  } catch (error) {
    console.error('List projects error:', error)
    return errorResponse(error.message || 'Failed to list projects')
  }
})