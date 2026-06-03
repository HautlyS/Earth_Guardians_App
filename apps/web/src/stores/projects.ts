/**
 * Projects Store
 * Earth Guardians Platform
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

export interface Project {
  id: string
  crew_id: string | null
  name: string
  description: string | null
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'archived'
  visibility?: string
  priority?: string
  start_date?: string | null
  end_date?: string | null
  tags?: string[]
  cover_image?: string | null
  created_by: string
  created_at: string
  updated_at?: string
  // Relations
  creator?: { id: string; username: string; display_name: string | null; avatar_url: string | null }
  crew?: { id: string; name: string; slug: string }
  tasks?: { count: number }[]
}

export const useProjectsStore = defineStore('projects', () => {
  // State
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  // Getters
  const activeProjects = computed(() => projects.value.filter(p => p.status === 'active'))
  const planningProjects = computed(() => projects.value.filter(p => p.status === 'planning'))
  const completedProjects = computed(() => projects.value.filter(p => p.status === 'completed'))

  // Actions
  async function fetchProjects(options?: { crew_id?: string; status?: string; limit?: number; offset?: number }) {
    loading.value = true
    error.value = null

    try {
      let query = supabase
        .from('projects')
        .select(`
          *,
          creator:profiles!created_by(id, username, display_name, avatar_url),
          crew:crews(id, name, slug)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })

      if (options?.crew_id) {
        query = query.eq('crew_id', options.crew_id)
      }

      if (options?.status) {
        query = query.eq('status', options.status)
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
      }

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      projects.value = data || []
      totalCount.value = count || 0
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch projects'
      console.error('Fetch projects error:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchProject(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select(`
          *,
          creator:profiles!created_by(id, username, display_name, avatar_url),
          crew:crews(id, name, slug)
        `)
        .eq('id', projectId)
        .single()

      if (fetchError) throw fetchError

      currentProject.value = data
      return data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch project'
      console.error('Fetch project error:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function createProject(projectData: Partial<Project>) {
    loading.value = true
    error.value = null

    try {
      const { data, error: createError } = await supabase
        .from('projects')
        .insert(projectData)
        .select(`
          *,
          creator:profiles!created_by(id, username, display_name, avatar_url)
        `)
        .single()

      if (createError) throw createError

      projects.value.unshift(data)
      return { success: true, project: data }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create project'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function updateProject(projectId: string, updates: Partial<Project>) {
    loading.value = true
    error.value = null

    try {
      const { data, error: updateError } = await supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select()
        .single()

      if (updateError) throw updateError

      // Update in list
      const index = projects.value.findIndex(p => p.id === projectId)
      if (index !== -1) {
        projects.value[index] = { ...projects.value[index], ...data }
      }

      // Update current if same
      if (currentProject.value?.id === projectId) {
        currentProject.value = { ...currentProject.value, ...data }
      }

      return { success: true, project: data }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update project'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function deleteProject(projectId: string) {
    loading.value = true
    error.value = null

    try {
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (deleteError) throw deleteError

      projects.value = projects.value.filter(p => p.id !== projectId)
      if (currentProject.value?.id === projectId) {
        currentProject.value = null
      }

      return { success: true }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete project'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  function clearCurrentProject() {
    currentProject.value = null
  }

  return {
    // State
    projects,
    currentProject,
    loading,
    error,
    totalCount,

    // Getters
    activeProjects,
    planningProjects,
    completedProjects,

    // Actions
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    clearCurrentProject
  }
})