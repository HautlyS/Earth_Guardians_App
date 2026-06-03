/**
 * Projects Store
 * Earth Guardians Platform
 */
import { defineStore } from 'pinia'
import { ref, computed, onScopeDispose } from 'vue'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived'
export type ProjectVisibility = 'public' | 'private' | 'team'
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Project {
  id: string
  crew_id: string | null
  name: string
  description: string | null
  status: ProjectStatus
  visibility?: ProjectVisibility
  priority?: ProjectPriority
  start_date?: string | null
  end_date?: string | null
  tags?: string[]
  cover_image?: string | null
  created_by: string
  created_at: string
  updated_at?: string
  creator?: { id: string; username: string; display_name: string | null; avatar_url: string | null }
  crew?: { id: string; name: string; slug: string }
  tasks?: { count: number }[]
  task_stats?: { total: number; done: number }
}

export interface ProjectCreateInput {
  name: string
  description?: string
  crew_id?: string
  visibility?: ProjectVisibility
  priority?: ProjectPriority
  status?: ProjectStatus
  start_date?: string
  end_date?: string
  tags?: string[]
  cover_image?: string
}

const PROJECT_SELECT = `
  *,
  creator:profiles!projects_created_by_fkey(id, username, display_name, avatar_url),
  crew:crews(id, name, slug),
  tasks(id, status)
`

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)
  const page = ref(0)
  const pageSize = ref(20)

  const activeProjects = computed(() => projects.value.filter((p) => p.status === 'active'))
  const planningProjects = computed(() => projects.value.filter((p) => p.status === 'planning'))
  const completedProjects = computed(() => projects.value.filter((p) => p.status === 'completed'))

  let channel: RealtimeChannel | null = null

  async function fetchProjects(options?: {
    crew_id?: string
    status?: ProjectStatus
    limit?: number
    offset?: number
    search?: string
  }): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const limit = options?.limit ?? pageSize.value
      const offset = options?.offset ?? page.value * pageSize.value
      let query = supabase
        .from('projects')
        .select(PROJECT_SELECT, { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (options?.crew_id) query = query.eq('crew_id', options.crew_id)
      if (options?.status) query = query.eq('status', options.status)
      if (options?.search) {
        const pat = `%${options.search}%`
        query = query.or(`name.ilike.${pat},description.ilike.${pat}`)
      }

      const { data, error: fetchError, count } = await query
      if (fetchError) throw fetchError
      projects.value = (data ?? []).map((p) => decorateWithTaskStats(p as Project))
      totalCount.value = count ?? 0
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch projects'
      console.error('Fetch projects error:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchNextPage(): Promise<void> {
    page.value += 1
    try {
      await fetchProjects({ offset: page.value * pageSize.value })
    } catch {
      page.value -= 1
    }
  }

  async function fetchProject(projectId: string): Promise<Project | null> {
    loading.value = true
    error.value = null
    try {
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select(PROJECT_SELECT)
        .eq('id', projectId)
        .maybeSingle()
      if (fetchError) throw fetchError
      const decorated = decorateWithTaskStats((data ?? null) as Project | null)
      currentProject.value = decorated
      return decorated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch project'
      console.error('Fetch project error:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function createProject(
    input: ProjectCreateInput
  ): Promise<{ success: boolean; project?: Project; error?: string }> {
    loading.value = true
    error.value = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error: createError } = await supabase
        .from('projects')
        .insert({
          name: input.name.trim(),
          description: input.description?.trim() || null,
          crew_id: input.crew_id ?? null,
          visibility: input.visibility ?? 'private',
          priority: input.priority ?? 'medium',
          status: input.status ?? 'planning',
          start_date: input.start_date ?? null,
          end_date: input.end_date ?? null,
          tags: input.tags ?? [],
          cover_image: input.cover_image ?? null,
          created_by: user.id,
        })
        .select(PROJECT_SELECT)
        .single()
      if (createError) throw createError
      const decorated = decorateWithTaskStats(data as Project)
      projects.value.unshift(decorated)
      return { success: true, project: decorated }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create project'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function updateProject(
    projectId: string,
    updates: Partial<ProjectCreateInput>
  ): Promise<{ success: boolean; project?: Project; error?: string }> {
    loading.value = true
    error.value = null
    try {
      const { data, error: updateError } = await supabase
        .from('projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select(PROJECT_SELECT)
        .single()
      if (updateError) throw updateError
      const decorated = decorateWithTaskStats(data as Project)
      const idx = projects.value.findIndex((p) => p.id === projectId)
      if (idx !== -1) projects.value[idx] = decorated
      if (currentProject.value?.id === projectId) currentProject.value = decorated
      return { success: true, project: decorated }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update project'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function deleteProject(projectId: string): Promise<{ success: boolean; error?: string }> {
    loading.value = true
    error.value = null
    try {
      const { error: deleteError } = await supabase
        .from('projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', projectId)
      if (deleteError) throw deleteError
      projects.value = projects.value.filter((p) => p.id !== projectId)
      if (currentProject.value?.id === projectId) currentProject.value = null
      return { success: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete project'
      error.value = msg
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  function decorateWithTaskStats(p: Project | null): Project | null {
    if (!p) return p
    const tasks = (p as Project & { tasks?: { status: string }[] }).tasks
    if (Array.isArray(tasks)) {
      const total = tasks.length
      const done = tasks.filter((t) => t.status === 'done').length
      p.task_stats = { total, done }
    }
    return p
  }

  function clearCurrentProject(): void {
    currentProject.value = null
  }

  function clear(): void {
    projects.value = []
    currentProject.value = null
    page.value = 0
  }

  function subscribeToChanges(): void {
    if (channel) return
    channel = supabase
      .channel('projects-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const p = (payload.new as Project)
            if (!projects.value.some((x) => x.id === p.id)) projects.value.unshift(p)
          } else if (payload.eventType === 'UPDATE') {
            const p = payload.new as Project
            const idx = projects.value.findIndex((x) => x.id === p.id)
            if (idx !== -1) projects.value[idx] = { ...projects.value[idx], ...p }
            if (currentProject.value?.id === p.id) currentProject.value = { ...currentProject.value, ...p }
          } else if (payload.eventType === 'DELETE') {
            const p = payload.old as { id: string }
            projects.value = projects.value.filter((x) => x.id !== p.id)
            if (currentProject.value?.id === p.id) currentProject.value = null
          }
        }
      )
      .subscribe()
  }

  function unsubscribe(): void {
    if (channel) {
      void supabase.removeChannel(channel)
      channel = null
    }
  }

  onScopeDispose(() => unsubscribe())

  return {
    projects,
    currentProject,
    loading,
    error,
    totalCount,
    page,
    pageSize,
    activeProjects,
    planningProjects,
    completedProjects,
    fetchProjects,
    fetchNextPage,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    clearCurrentProject,
    clear,
    subscribeToChanges,
    unsubscribe,
  }
})
