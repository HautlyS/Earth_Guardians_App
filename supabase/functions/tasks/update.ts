/**
 * Update Task Edge Function
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

    // Get task ID from URL path
    const url = new URL(req.url)
    const taskId = url.pathname.split('/').pop()

    if (!taskId || taskId === 'update') {
      return errorResponse('Task ID is required', 400)
    }

    const updates = await req.json()

    // Get current task for comparison
    const { data: oldTask } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (!oldTask) {
      return errorResponse('Task not found', 404)
    }

    // Apply updates
    const updateData: any = { ...updates }
    
    // Set completed_at when status changes to 'done'
    if (updates.status === 'done' && oldTask.status !== 'done') {
      updateData.completed_at = new Date().toISOString()
    }

    // Update task
    const { data: task, error: updateError } = await supabase
      .from('tasks')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select(`
        *,
        assignees_list:profiles!tasks_assignees_fkey(id, username, display_name, avatar_url)
      `)
      .single()

    if (updateError) throw updateError

    // Notify about status change
    if (updates.status && updates.status !== oldTask.status) {
      const assignees = (oldTask.assignees || []).filter((id: string) => id !== user.id)
      
      if (assignees.length > 0) {
        const notifications = assignees.map(assigneeId => ({
          user_id: assigneeId,
          title: 'Task status updated',
          body: `Task "${oldTask.title}" is now ${updates.status}`,
          type: 'task_status_changed',
          data: { task_id: task.id, project_id: oldTask.project_id }
        }))

        await supabase.from('notifications').insert(notifications)
      }
    }

    // Log activity
    await logActivity(supabase, user.id, 'task_updated', 'task', task.id, {
      old_status: oldTask.status,
      new_status: updates.status
    })

    // Log to project activities
    await supabase.from('project_activities').insert({
      project_id: oldTask.project_id,
      user_id: user.id,
      action: 'task_updated',
      entity_type: 'task',
      entity_id: task.id,
      old_data: oldTask,
      new_data: task
    })

    return successResponse({
      success: true,
      task
    })

  } catch (error) {
    console.error('Update task error:', error)
    return errorResponse(error.message || 'Failed to update task')
  }
})