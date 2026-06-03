/**
 * Get Profile Edge Function
 * Earth Guardians Platform
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, successResponse, validateAuth } from '../_shared/cors.ts'

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
    const targetUserId = url.searchParams.get('user_id') || user.id

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        *,
        notification_preferences(*)
      `)
      .eq('user_id', targetUserId)
      .single()

    if (profileError) {
      return errorResponse('Profile not found', 404)
    }

    // Get user stats
    const { count: projectsCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', targetUserId)
      .is('deleted_at', null)

    const { count: tasksCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .contains('assignees', [targetUserId])
      .is('deleted_at', null)

    const { count: crewCount } = await supabase
      .from('crew_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId)

    // Get recent activity
    const { data: recentActivity } = await supabase
      .from('activity_logs')
      .select('action, created_at')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(10)

    return successResponse({
      profile: {
        ...profile,
        stats: {
          projects: projectsCount || 0,
          tasks: tasksCount || 0,
          crews: crewCount || 0
        },
        recent_activity: recentActivity || []
      }
    })

  } catch (error) {
    console.error('Get profile error:', error)
    return errorResponse(error.message || 'Failed to get profile')
  }
})