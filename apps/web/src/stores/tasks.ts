/**
 * Tasks Store
 * Earth Guardians Platform
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
  priority?: string
  assignees: string[]
  due_date: string | null
  estimated_hours?: number | null
  actual_hours?: number | null
  tags?: string[]
  position?: number
  completed_at?: string | null
  created_at: string
  updated_at?: string
  // Relations
  assignees_list?: { id: string; username: string; display_name: string | null; avatar_url: string | null }[]
}

export const useTasksStore = defineStore('tasks', () => {
  // State
  const tasks = ref<Task[]>([])
  const currentTask = ref<Task | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const todoTasks = computed(() => tasks.value.filter(t => t.status === 'todo'))
  const inProgressTasks = computed(() => tasks.value.filter(t => t.status === 'in_progress'))
  const doneTasks = computed(() => tasks.value.filter(t => t.status === 'done'))
  const backlogTasks = computed(() => tasks.value.filter(t => t.status === 'backlog'))

  // Actions
  async function fetchTasks(projectId: string, options?: { status?: string; assignees?: string[] }) {
    loading.value = true
    error.value = null

    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assignees_list:profiles!tasks_assignees_fkey(id, username, display_name, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })

      if (options?.status) {
        query = query.eq('status', options.status)
      }

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      tasks.value = data || []
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch tasks'
      console.error('Fetch tasks error:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchTask(taskId: string) {
    loading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select(`
          *,
          assignees_list:profiles!tasks_assignees_fkey(id, username, display_name, avatar_url)
        `)
        .eq('id', taskId)
        .single()

      if (fetchError) throw fetchError

      currentTask.value = data
      return data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch task'
      return null
    } finally {
      loading.value = false
    }
  }

  async function createTask(taskData: Partial<Task>) {
    loading.value = true
    error.value = null

    try {
      const { data, error: createError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select(`
          *,
          assignees_list:profiles!tasks_assignees_fkey(id, username, display_name, avatar_url)
        `)
        .single()

      if (createError) throw createError

      tasks.value.unshift(data)
      return { success: true, task: data }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create task'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function updateTask(taskId: string, updates: Partial<Task>) {
    loading.value = true
    error.value = null

    try {
      const updateData = { ...updates }
      if (updates.status === 'done' && !updates.completed_at) {
        updateData.completed_at = new Date().toISOString()
      }

      const { data, error: updateError } = await supabase
        .from('tasks')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .select(`
          *,
          assignees_list:profiles!tasks_assignees_fkey(id, username, display_name, avatar_url)
        `)
        .single()

      if (updateError) throw updateError

      const index = tasks.value.findIndex(t => t.id === taskId)
      if (index !== -1) {
        tasks.value[index] = data
      }

      if (currentTask.value?.id === taskId) {
        currentTask.value = data
      }

      return { success: true, task: data }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update task'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function deleteTask(taskId: string) {
    loading.value = true
    error.value = null

    try {
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (deleteError) throw deleteError

      tasks.value = tasks.value.filter(t => t.id !== taskId)
      if (currentTask.value?.id === taskId) {
        currentTask.value = null
      }

      return { success: true }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete task'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function moveTask(taskId: string, newStatus: string, newPosition?: number) {
    const updates: Partial<Task> = { status: newStatus as Task['status'] }
    if (newPosition !== undefined) {
      updates.position = newPosition
    }
    return updateTask(taskId, updates)
  }

  function handleRealtimeChange(payload: any) {
    const { eventType, new: newRecord, old: oldRecord } = payload

    switch (eventType) {
      case 'INSERT':
        if (!tasks.value.find(t => t.id === newRecord.id)) {
          tasks.value.push(newRecord)
        }
        break
      case 'UPDATE':
        const updateIndex = tasks.value.findIndex(t => t.id === newRecord.id)
        if (updateIndex !== -1) {
          tasks.value[updateIndex] = { ...tasks.value[updateIndex], ...newRecord }
        }
        break
      case 'DELETE':
        tasks.value = tasks.value.filter(t => t.id !== oldRecord.id)
        break
    }
  }

  function clearTasks() {
    tasks.value = []
    currentTask.value = null
  }

  return {
    // State
    tasks,
    currentTask,
    loading,
    error,

    // Getters
    todoTasks,
    inProgressTasks,
    doneTasks,
    backlogTasks,

    // Actions
    fetchTasks,
    fetchTask,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    handleRealtimeChange,
    clearTasks
  }
})