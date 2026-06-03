/**
 * Create Project Edge Function
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

    const { 
      name, 
      description, 
      crew_id, 
      visibility = 'private',
      priority = 'medium',
      start_date,
      end_date,
      tags = []
    } = await req.json()

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return errorResponse('Project name is required', 400)
    }

    // Verify crew access if crew_id provided
    if (crew_id) {
      const { data: crewMember } = await supabase
        .from('crew_members')
        .select('id')
        .eq('crew_id', crew_id)
        .eq('user_id', user.id)
        .single()

      if (!crewMember) {
        return errorResponse('You are not a member of this crew', 403)
      }
    }

    // Create project
    const { data: project, error: createError } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        crew_id: crew_id || null,
        visibility,
        priority,
        start_date: start_date || null,
        end_date: end_date || null,
        tags,
        status: 'planning',
        created_by: user.id
      })
      .select(`
        *,
        creator:profiles!created_by(id, username, display_name, avatar_url),
        crew:crews(id, name, slug)
      `)
      .single()

    if (createError) throw createError

    // Log activity
    await logActivity(supabase, user.id, 'project_created', 'project', project.id, { name: project.name })

    return successResponse({
      success: true,
      project
    })

  } catch (error) {
    console.error('Create project error:', error)
    return errorResponse(error.message || 'Failed to create project')
  }
})