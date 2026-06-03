/**
 * Create Task Edge Function
 * Earth Guardians Platform
 *
 * Sets created_by, position, and writes a project_activities entry
 * (consistency with the activity feed). Notifications respect user
 * preferences via a non-blocking preference check.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, errorResponse, successResponse, validateAuth, logActivity } from '../_shared/cors.ts'

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

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
      project_id,
      title,
      description,
      assignees = [],
      due_date,
      priority = 'medium',
      tags = [],
      dependencies = [],
      parent_task_id,
    } = body as Record<string, unknown>

    if (typeof project_id !== 'string' || !isUuid(project_id)) {
      return errorResponse('project_id (UUID) is required', 400)
    }
    if (typeof title !== 'string' || !title.trim()) {
      return errorResponse('Task title is required', 400)
    }

    const validAssignees = Array.isArray(assignees)
      ? assignees.filter((a: unknown): a is string => typeof a === 'string' && isUuid(a))
      : []

    const { data: project } = await supabase
      .from('projects')
      .select('id, crew_id, name, created_by')
      .eq('id', project_id)
      .maybeSingle()

    if (!project) return errorResponse('Project not found', 404)

    // Position: append to end
    const { data: lastTask } = await supabase
      .from('tasks')
      .select('position')
      .eq('project_id', project_id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    const position = ((lastTask as { position?: number } | null)?.position ?? 0) + 1

    const { data: task, error: createError } = await supabase
      .from('tasks')
      .insert({
        project_id,
        title: title.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        assignees: validAssignees,
        due_date: typeof due_date === 'string' ? due_date : null,
        priority: ['low', 'medium', 'high', 'urgent'].includes(priority as string) ? priority : 'medium',
        tags: Array.isArray(tags) ? tags : [],
        dependencies: Array.isArray(dependencies) ? dependencies : [],
        position,
        status: 'todo',
        created_by: user.id,
        parent_task_id: typeof parent_task_id === 'string' && isUuid(parent_task_id) ? parent_task_id : null,
      })
      .select(
        `*, assignees_list:profiles!tasks_assignees_fkey(id, username, display_name, avatar_url)`
      )
      .single()

    if (createError) throw createError

    // Notifications to assignees (other than the creator) — preference-aware
    const otherAssignees = validAssignees.filter((id) => id !== user.id)
    if (otherAssignees.length > 0) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('user_id, in_app_on_task_assign')
        .in('user_id', otherAssignees)

      const enabledIds = new Set(
        (prefs ?? [])
          .filter((p: Record<string, unknown>) => p.in_app_on_task_assign !== false)
          .map((p: Record<string, unknown>) => p.user_id as string)
      )
      const toNotify = otherAssignees.filter((id) => enabledIds.size === 0 || enabledIds.has(id))
      if (toNotify.length > 0) {
        await supabase.from('notifications').insert(
          toNotify.map((id) => ({
            user_id: id,
            type: 'task_assigned',
            title: 'New task assigned',
            body: `You have been assigned to: ${title}`,
            data: { task_id: (task as { id: string }).id, project_id },
          }))
        )
      }
    }

    await logActivity(supabase, user.id, 'task_created', 'task', (task as { id: string }).id, {
      title,
      project_id,
    })

    await supabase.from('project_activities').insert({
      project_id,
      user_id: user.id,
      action: 'task_created',
      entity_type: 'task',
      entity_id: (task as { id: string }).id,
      new_data: { title, assignees: validAssignees },
    })

    return successResponse({ success: true, task })
  } catch (error) {
    console.error('Create task error:', error)
    return errorResponse(error.message || 'Failed to create task')
  }
})
