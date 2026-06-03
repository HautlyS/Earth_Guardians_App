/**
 * Global Search Edge Function
 * Earth Guardians Platform
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, successResponse, validateAuth, logActivity } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { error, user } = await validateAuth(supabase, req)
    if (error || !user) {
      return errorResponse(error || 'Unauthorized', 401)
    }

    const url = new URL(req.url)
    const query = url.searchParams.get('q')
    const type = url.searchParams.get('type') // 'projects', 'tasks', 'documents', 'users', 'all'
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50)

    if (!query || query.length < 2) {
      return errorResponse('Query must be at least 2 characters', 400)
    }

    const results: any = { query, type: type || 'all' }
    const searchPattern = `%${query}%`

    // Get user's crew IDs for filtering
    const { data: userCrews } = await supabase
      .from('crew_members')
      .select('crew_id')
      .eq('user_id', user.id)
    
    const crewIds = userCrews?.map(c => c.crew_id) || []

    // Search projects
    if (!type || type === 'projects' || type === 'all') {
      let projectQuery = supabase
        .from('projects')
        .select('id, name, description, status, created_at, crew:crews(name)')
        .is('deleted_at', null)
        .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .limit(limit)

      // Filter by access
      if (crewIds.length > 0) {
        projectQuery = projectQuery.or(`crew_id.in.(${crewIds.join(',')}),created_by.eq.${user.id}`)
      } else {
        projectQuery = projectQuery.eq('created_by', user.id)
      }

      const { data: projects } = await projectQuery
      results.projects = projects || []
    }

    // Search tasks
    if (!type || type === 'tasks' || type === 'all') {
      let taskQuery = supabase
        .from('tasks')
        .select('id, title, description, status, project_id, due_date')
        .is('deleted_at', null)
        .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .limit(limit)

      // Filter by user's tasks
      taskQuery = taskQuery.contains('assignees', [user.id])

      const { data: tasks } = await taskQuery
      results.tasks = tasks || []
    }

    // Search documents
    if (!type || type === 'documents' || type === 'all') {
      const { data: documents } = await supabase
        .from('documents')
        .select('id, title, doc_type, created_at')
        .or(`title.ilike.${searchPattern}`)
        .limit(limit)

      results.documents = documents || []
    }

    // Search users
    if (!type || type === 'users' || type === 'all') {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .or(`username.ilike.${searchPattern},display_name.ilike.${searchPattern}`)
        .limit(limit)

      results.users = users || []
    }

    // Log search activity
    await logActivity(supabase, user.id, 'search', 'search', undefined, {
      query,
      type: type || 'all',
      result_count: Object.values(results).flat().length
    })

    // Calculate total results
    results.total = (results.projects?.length || 0) +
                   (results.tasks?.length || 0) +
                   (results.documents?.length || 0) +
                   (results.users?.length || 0)

    return successResponse(results)

  } catch (error) {
    console.error('Search error:', error)
    return errorResponse(error.message || 'Search failed')
  }
})