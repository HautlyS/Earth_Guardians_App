/**
 * Get Profile Edge Function
 * Earth Guardians Platform
 *
 * Returns a profile, stats (projects, open tasks, crews, documents), and
 * recent activity. Staff/admin can view any profile; everyone else can
 * only view themselves.
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
    const requestedId = url.searchParams.get('user_id')
    const targetUserId = requestedId || user.id

    // Self always allowed; otherwise only staff / regional_councilor can view
    if (targetUserId !== user.id) {
      const { data: me } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
      const role = (me as { role?: string } | null)?.role
      if (role !== 'staff' && role !== 'regional_councilor') {
        return errorResponse('Forbidden', 403)
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (profileError) {
      return errorResponse('Profile fetch failed: ' + profileError.message, 500)
    }
    if (!profile) {
      return errorResponse('Profile not found', 404)
    }

    const [projectsRes, tasksRes, crewRes, docsRes, activityRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', targetUserId)
        .is('deleted_at', null),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .contains('assignees', [targetUserId])
        .is('deleted_at', null)
        .neq('status', 'done'),
      supabase
        .from('crew_members')
        .select('crew_id', { count: 'exact', head: true })
        .eq('user_id', targetUserId),
      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', targetUserId),
      supabase
        .from('activity_logs')
        .select('action, created_at, entity_type, entity_id')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    return successResponse({
      profile: {
        ...profile,
        stats: {
          projects: projectsRes.count ?? 0,
          tasks: tasksRes.count ?? 0,
          crews: crewRes.count ?? 0,
          documents: docsRes.count ?? 0,
        },
        recent_activity: activityRes.data ?? [],
      },
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return errorResponse(error.message || 'Failed to get profile')
  }
})
