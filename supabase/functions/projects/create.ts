/**
 * Create Project Edge Function
 * Earth Guardians Platform
 *
 * Sets created_by, validates the crew membership if crew_id is given,
 * and writes a project_activities entry (consistency with task creation).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, successResponse, validateAuth, logActivity } from '../_shared/cors.ts'

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

const VALID_VISIBILITY = ['public', 'private', 'team'] as const
const VALID_PRIORITY = ['low', 'medium', 'high', 'urgent'] as const

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

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid JSON body', 400)
    }

    const {
      name,
      description,
      crew_id,
      visibility = 'private',
      priority = 'medium',
      start_date,
      end_date,
      tags = [],
    } = body as Record<string, unknown>

    if (typeof name !== 'string' || !name.trim()) {
      return errorResponse('Project name is required', 400)
    }
    if (name.length > 100) {
      return errorResponse('Project name must be 100 characters or fewer', 400)
    }

    let crewId: string | null = null
    if (typeof crew_id === 'string' && crew_id.length > 0) {
      if (!isUuid(crew_id)) {
        return errorResponse('crew_id must be a UUID', 400)
      }
      const { data: crewMember } = await supabase
        .from('crew_members')
        .select('id')
        .eq('crew_id', crew_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!crewMember) {
        return errorResponse('You are not a member of this crew', 403)
      }
      crewId = crew_id
    }

    const vis = VALID_VISIBILITY.includes(visibility as typeof VALID_VISIBILITY[number])
      ? (visibility as typeof VALID_VISIBILITY[number])
      : 'private'
    const pri = VALID_PRIORITY.includes(priority as typeof VALID_PRIORITY[number])
      ? (priority as typeof VALID_PRIORITY[number])
      : 'medium'

    const { data: project, error: createError } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        crew_id: crewId,
        visibility: vis,
        priority: pri,
        start_date: typeof start_date === 'string' ? start_date : null,
        end_date: typeof end_date === 'string' ? end_date : null,
        tags: Array.isArray(tags) ? tags : [],
        status: 'planning',
        created_by: user.id,
      })
      .select(
        `*, creator:profiles!created_by(id, username, display_name, avatar_url), crew:crews(id, name, slug)`
      )
      .single()

    if (createError) throw createError

    await logActivity(supabase, user.id, 'project_created', 'project', (project as { id: string }).id, {
      name,
    })

    await supabase.from('project_activities').insert({
      project_id: (project as { id: string }).id,
      user_id: user.id,
      action: 'project_created',
      entity_type: 'project',
      entity_id: (project as { id: string }).id,
      new_data: { name, visibility: vis, priority: pri },
    })

    return successResponse({ success: true, project })
  } catch (error) {
    console.error('Create project error:', error)
    return errorResponse(error.message || 'Failed to create project')
  }
})
