/**
 * Tasks Store
 * Earth Guardians Platform
 */
import { defineStore } from 'pinia'
import { ref, computed, onScopeDispose } from 'vue'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority?: TaskPriority
  assignees: string[]
  due_date: string | null
  estimated_hours?: number | null
  actual_hours?: number | null
  tags?: string[]
  position?: number
  completed_at?: string | null
  created_at: string
  updated_at?: string
  created_by?: string
  parent_task_id?: string | null
  assignees_list?: { id: string; username: string; display_name: string | null; avatar_url: string | null }[]
}

export interface TaskCreateInput {
  project_id: string
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assignees?: string[]
  due_date?: string | null
  estimated_hours?: number | null
  tags?: string[]
  parent_task_id?: string | null
}

const TASK_SELECT = `
  *,
  assignees_list:profiles!tasks_assignees_fkey(id, username, display_name, avatar_url)
`

export const useTasksStore = defineStore('tasks', () => {
  const tasksByProject = ref<Record<string, Task[]>>({})
  const currentTask = ref<Task | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filter = ref<TaskStatus | 'all'>('all')

  const tasks = computed(() => {
    const all = Object.values(tasksByProject.value).flat()
    if (filter.value === 'all') return all
    return all.filter((t) => t.status === filter.value)
  })
  const todoTasks = computed(() => tasks.value.filter((t) => t.status === 'todo'))
  const inProgressTasks = computed(() => tasks.value.filter((t) => t.status === 'in_progress'))
  const doneTasks = computed(() => tasks.value.filter((t) => t.status === 'done'))
  const backlogTasks = computed(() => tasks.value.filter((t) => t.status === 'backlog'))

  let channel: RealtimeChannel | null = null

  async function fetchTasks(
    projectId: string,
    options?: { status?: TaskStatus; sort?: 'position' | 'due_date' | 'priority' | 'created_at' }
  ): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const sort = options?.sort ?? 'position'
      let query = supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('project_id', projectId)
        .is('deleted_at', null)
      if (options?.status) query = query.eq('status', options.status)

      if (sort === 'position') query = query.order('position', { ascending: true })
      else if (sort === 'due_date') query = query.order('due_date', { ascending: true, nullsFirst: false })
      else if (sort === 'priority') query = query.order('priority', { ascending: false })
      else query = query.order('created_at', { ascending: false })

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError
      tasksByProject.value[projectId] = (data ?? []) as Task[]
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch tasks'
      console.error('Fetch tasks error:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchAllUserTasks(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .contains('assignees', [user.id])
        .is('deleted_at', null)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(200)
      if (fetchError) throw fetchError
      const grouped: Record<string, Task[]> = {}
      for (const t of (data ?? []) as Task[]) {
        if (!grouped[t.project_id]) grouped[t.project_id] = []
        grouped[t.project_id].push(t)
      }
      tasksByProject.value = grouped
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch user tasks'
      console.error('Fetch user tasks error:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchTask(taskId: string): Promise<Task | null> {
    loading.value = true
    error.value = null
    try {
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .eq('id', taskId)
        .maybeSingle()
      if (fetchError) throw fetchError
      currentTask.value = (data ?? null) as Task | null
      return currentTask.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch task'
      console.error('Fetch task error:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function createTask(
    input: TaskCreateInput
  ): Promise<{ success: boolean; task?: Task; error?: string }> {
    loading.value = true
    error.value = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Position: append to end
      const list = tasksByProject.value[input.project_id] ?? []
      const maxPos = list.reduce((max, t) => Math.max(max, t.position ?? 0), 0)

      const { data, error: createError } = await supabase
        .from('tasks')
        .insert({
          project_id: input.project_id,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          status: input.status ?? 'todo',
          priority: input.priority ?? 'medium',
          assignees: input.assignees ?? [],
          due_date: input.due_date ?? null,
          estimated_hours: input.estimated_hours ?? null,
          tags: input.tags ?? [],
          position: maxPos + 1,
          created_by: user.id,
          parent_task_id: input.parent_task_id ?? null,
        })
        .select(TASK_SELECT)
        .single()
      if (createError) throw createError

      const task = data as Task
      if (!tasksByProject.value[input.project_id]) tasksByProject.value[input.project_id] = []
      tasksByProject.value[input.project_id].push(task)
      return { success: true, task }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create task'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function updateTask(
    taskId: string,
    updates: Partial<Task>
  ): Promise<{ success: boolean; task?: Task; error?: string }> {
    const idx = findIndex(taskId)
    if (idx === -1) {
      const current = await fetchTask(taskId)
      if (!current) return { success: false, error: 'Task not found' }
    }
    const updateData: Partial<Task> = { ...updates, updated_at: new Date().toISOString() as unknown as string }
    if (updates.status === 'done' && !updates.completed_at) {
      updateData.completed_at = new Date().toISOString()
    }
    loading.value = true
    error.value = null
    try {
      const { data, error: updateError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select(TASK_SELECT)
        .single()
      if (updateError) throw updateError
      const task = data as Task
      applyTask(task)
      if (currentTask.value?.id === taskId) currentTask.value = task
      return { success: true, task }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update task'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function deleteTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    const idx = findIndex(taskId)
    const projectId = idx.projectId
    loading.value = true
    error.value = null
    try {
      const { error: deleteError } = await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', taskId)
      if (deleteError) throw deleteError
      if (projectId && tasksByProject.value[projectId]) {
        tasksByProject.value[projectId] = tasksByProject.value[projectId].filter((t) => t.id !== taskId)
      }
      if (currentTask.value?.id === taskId) currentTask.value = null
      return { success: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete task'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function moveTask(
    taskId: string,
    newStatus: TaskStatus,
    newPosition?: number
  ): Promise<{ success: boolean; task?: Task; error?: string }> {
    return updateTask(taskId, { status: newStatus, position: newPosition })
  }

  function findIndex(taskId: string): { projectId: string | null; index: number } {
    for (const [projectId, list] of Object.entries(tasksByProject.value)) {
      const index = list.findIndex((t) => t.id === taskId)
      if (index !== -1) return { projectId, index }
    }
    return { projectId: null, index: -1 }
  }

  function applyTask(task: Task): void {
    const { projectId, index } = findIndex(task.id)
    if (!projectId) {
      if (!tasksByProject.value[task.project_id]) tasksByProject.value[task.project_id] = []
      tasksByProject.value[task.project_id].push(task)
      return
    }
    if (index !== -1) tasksByProject.value[projectId][index] = task
  }

  function handleRealtimeChange(payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: Task; old: { id: string } }): void {
    if (payload.eventType === 'INSERT') applyTask(payload.new)
    else if (payload.eventType === 'UPDATE') applyTask(payload.new)
    else if (payload.eventType === 'DELETE') {
      const { projectId } = findIndex(payload.old.id)
      if (projectId && tasksByProject.value[projectId]) {
        tasksByProject.value[projectId] = tasksByProject.value[projectId].filter((t) => t.id !== payload.old.id)
      }
    }
  }

  function subscribeToProject(projectId: string): void {
    if (channel) return
    channel = supabase
      .channel(`tasks-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
        (payload) =>
          handleRealtimeChange(payload as { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: Task; old: { id: string } })
      )
      .subscribe()
  }

  function unsubscribe(): void {
    if (channel) {
      void supabase.removeChannel(channel)
      channel = null
    }
  }

  function clearTasks(): void {
    tasksByProject.value = {}
    currentTask.value = null
  }

  onScopeDispose(() => unsubscribe())

  return {
    tasksByProject,
    tasks,
    currentTask,
    loading,
    error,
    filter,
    todoTasks,
    inProgressTasks,
    doneTasks,
    backlogTasks,
    fetchTasks,
    fetchAllUserTasks,
    fetchTask,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    handleRealtimeChange,
    subscribeToProject,
    unsubscribe,
    clearTasks,
  }
})
