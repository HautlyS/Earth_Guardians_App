/**
 * Create Task Edge Function
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
      project_id, 
      title, 
      description,
      assignees = [],
      due_date,
      priority = 'medium',
      tags = [],
      dependencies = []
    } = await req.json()

    // Validate required fields
    if (!project_id) {
      return errorResponse('project_id is required', 400)
    }

    if (!title || title.trim().length === 0) {
      return errorResponse('Task title is required', 400)
    }

    // Verify project exists and user has access
    const { data: project } = await supabase
      .from('projects')
      .select('id, crew_id, name')
      .eq('id', project_id)
      .single()

    if (!project) {
      return errorResponse('Project not found', 404)
    }

    // Get max position for ordering
    const { data: lastTask } = await supabase
      .from('tasks')
      .select('position')
      .eq('project_id', project_id)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const position = (lastTask?.position || 0) + 1

    // Create task
    const { data: task, error: createError } = await supabase
      .from('tasks')
      .insert({
        project_id,
        title: title.trim(),
        description: description?.trim() || null,
        assignees,
        due_date: due_date || null,
        priority,
        tags,
        dependencies,
        position,
        status: 'todo'
      })
      .select(`
        *,
        assignees_list:profiles!tasks_assignees_fkey(id, username, display_name, avatar_url)
      `)
      .single()

    if (createError) throw createError

    // Send notifications to assignees
    if (assignees && assignees.length > 0) {
      const notifications = assignees
        .filter(id => id !== user.id)
        .map(assigneeId => ({
          user_id: assigneeId,
          title: 'New task assigned',
          body: `You have been assigned to: ${title}`,
          type: 'task_assigned',
          data: { task_id: task.id, project_id }
        }))

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications)
      }
    }

    // Log activity
    await logActivity(supabase, user.id, 'task_created', 'task', task.id, { 
      title: task.title,
      project_id 
    })

    // Log to project activities
    await supabase.from('project_activities').insert({
      project_id,
      user_id: user.id,
      action: 'task_created',
      entity_type: 'task',
      entity_id: task.id,
      new_data: { title, assignees }
    })

    return successResponse({
      success: true,
      task
    })

  } catch (error) {
    console.error('Create task error:', error)
    return errorResponse(error.message || 'Failed to create task')
  }
})