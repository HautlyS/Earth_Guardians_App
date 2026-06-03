<template>
  <div class="modal-overlay" @click.self="close">
    <div class="search-modal" role="dialog" aria-modal="true" aria-labelledby="search-modal-title">
      <div class="search-header">
        <input
          id="search-modal-title"
          ref="searchInput"
          v-model="query"
          type="text"
          placeholder="Search projects, tasks, docs, users..."
          class="search-input"
          aria-label="Search"
          @keydown.enter="onEnter"
          @keydown.esc="close"
          @keydown.down.prevent="moveSelection(1)"
          @keydown.up.prevent="moveSelection(-1)"
        />
        <button class="close-btn" @click="close" aria-label="Close search">×</button>
      </div>

      <div class="search-results" v-if="!loading && (projects.length || tasks.length || users.length || documents.length)">
        <div v-if="projects.length" class="result-section">
          <h4>Projects</h4>
          <button
            v-for="(project, idx) in projects"
            :key="`p-${project.id}`"
            :class="['result-item', { active: selectedIndex === flatIndex('projects', idx) }]"
            @click="goTo(`/projects/${project.id}`)"
            @mouseenter="setSelected(flatIndex('projects', idx))"
            type="button"
          >
            <span class="result-icon" aria-hidden="true">📁</span>
            <div class="result-content">
              <span class="result-title">{{ project.name }}</span>
              <span class="result-meta">{{ project.status }}</span>
            </div>
          </button>
        </div>

        <div v-if="tasks.length" class="result-section">
          <h4>Tasks</h4>
          <button
            v-for="(task, idx) in tasks"
            :key="`t-${task.id}`"
            :class="['result-item', { active: selectedIndex === flatIndex('tasks', idx) }]"
            @click="goTo(`/tasks`)"
            @mouseenter="setSelected(flatIndex('tasks', idx))"
            type="button"
          >
            <span class="result-icon" aria-hidden="true">✓</span>
            <div class="result-content">
              <span class="result-title">{{ task.title }}</span>
              <span class="result-meta">{{ task.status }}</span>
            </div>
          </button>
        </div>

        <div v-if="documents.length" class="result-section">
          <h4>Documents</h4>
          <button
            v-for="(doc, idx) in documents"
            :key="`d-${doc.id}`"
            :class="['result-item', { active: selectedIndex === flatIndex('documents', idx) }]"
            @click="goTo(`/docs`)"
            @mouseenter="setSelected(flatIndex('documents', idx))"
            type="button"
          >
            <span class="result-icon" aria-hidden="true">📄</span>
            <div class="result-content">
              <span class="result-title">{{ doc.title || doc.name }}</span>
              <span class="result-meta">{{ doc.document_type || 'document' }}</span>
            </div>
          </button>
        </div>

        <div v-if="users.length" class="result-section">
          <h4>Users</h4>
          <button
            v-for="(user, idx) in users"
            :key="`u-${user.id}`"
            :class="['result-item', { active: selectedIndex === flatIndex('users', idx) }]"
            @click="goTo(`/profile/${user.user_id || user.id}`)"
            @mouseenter="setSelected(flatIndex('users', idx))"
            type="button"
          >
            <UserAvatar :src="user.avatar_url" :name="user.display_name || user.username" size="sm" />
            <div class="result-content">
              <span class="result-title">{{ user.display_name || user.username }}</span>
              <span class="result-meta">{{ user.role }}</span>
            </div>
          </button>
        </div>
      </div>

      <div v-else-if="!loading && query.length >= 2" class="no-results">
        <p>No results found for "{{ query }}"</p>
      </div>

      <div v-if="loading" class="search-loading">
        <span>Searching…</span>
      </div>

      <div class="search-footer">
        <span class="hint">↑↓ to navigate · Enter to open · Esc to close</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import UserAvatar from './UserAvatar.vue'

const emit = defineEmits<{ (e: 'close'): void }>()

interface ProjectHit { id: string; name: string; status: string }
interface TaskHit { id: string; title: string; status: string }
interface UserHit {
  id: string
  user_id?: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}
interface DocumentHit { id: string; title?: string; name?: string; document_type?: string }

const router = useRouter()
const searchInput = ref<HTMLInputElement | null>(null)
const query = ref('')
const loading = ref(false)

const projects = ref<ProjectHit[]>([])
const tasks = ref<TaskHit[]>([])
const users = ref<UserHit[]>([])
const documents = ref<DocumentHit[]>([])

const selectedIndex = ref(0)

type Group = 'projects' | 'tasks' | 'documents' | 'users'
const groups: Group[] = ['projects', 'tasks', 'documents', 'users']

const groupOffset = (g: Group): number => {
  let off = 0
  for (const k of groups) {
    if (k === g) return off
    off += countForGroup(k)
  }
  return off
}
const countForGroup = (g: Group): number => {
  if (g === 'projects') return projects.value.length
  if (g === 'tasks') return tasks.value.length
  if (g === 'documents') return documents.value.length
  return users.value.length
}
const flatIndex = (g: Group, i: number) => groupOffset(g) + i
const totalResults = computed(
  () => projects.value.length + tasks.value.length + documents.value.length + users.value.length
)

let debounceId: number | null = null

watch(query, (q) => {
  if (debounceId !== null) {
    clearTimeout(debounceId)
    debounceId = null
  }
  if (q.length < 2) {
    projects.value = []
    tasks.value = []
    users.value = []
    documents.value = []
    return
  }
  debounceId = window.setTimeout(performSearch, 300)
})

async function performSearch() {
  if (query.value.length < 2) return
  loading.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      loading.value = false
      return
    }

    const pattern = `%${query.value}%`

    const [projRes, taskRes, userRes, docRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, status')
        .is('deleted_at', null)
        .or(`name.ilike.${pattern},description.ilike.${pattern}`)
        .limit(5),
      supabase
        .from('tasks')
        .select('id, title, status')
        .is('deleted_at', null)
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .limit(5),
      supabase
        .from('profiles')
        .select('id, user_id, username, display_name, avatar_url, role')
        .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
        .limit(5),
      supabase
        .from('documents')
        .select('id, title, name, document_type')
        .or(`title.ilike.${pattern},name.ilike.${pattern},content.ilike.${pattern}`)
        .limit(5)
    ])

    projects.value = (projRes.data as ProjectHit[] | null) ?? []
    tasks.value = (taskRes.data as TaskHit[] | null) ?? []
    users.value = (userRes.data as UserHit[] | null) ?? []
    documents.value = (docRes.data as DocumentHit[] | null) ?? []
    selectedIndex.value = 0
  } catch (e) {
    console.error('Search failed:', e)
  } finally {
    loading.value = false
  }
}

function setSelected(i: number) {
  selectedIndex.value = Math.max(0, Math.min(i, Math.max(0, totalResults.value - 1)))
}

function moveSelection(delta: number) {
  if (totalResults.value === 0) return
  setSelected(selectedIndex.value + delta)
}

function onEnter() {
  if (totalResults.value === 0) {
    performSearch()
    return
  }
  // Resolve selected item to its group
  let i = selectedIndex.value
  for (const g of groups) {
    const n = countForGroup(g)
    if (i < n) {
      if (g === 'projects') {
        const item = projects.value[i]
        if (item) goTo(`/projects/${item.id}`)
      } else if (g === 'tasks') {
        goTo(`/tasks`)
      } else if (g === 'documents') {
        goTo(`/docs`)
      } else {
        const item = users.value[i]
        if (item) goTo(`/profile/${item.user_id || item.id}`)
      }
      return
    }
    i -= n
  }
}

function goTo(path: string) {
  router.push(path).catch(() => {})
  emit('close')
}

function close() {
  emit('close')
}

onMounted(() => {
  searchInput.value?.focus()
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  if (debounceId !== null) clearTimeout(debounceId)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
  z-index: var(--z-modal, 200);
}

.search-modal {
  width: 100%;
  max-width: 600px;
  background: var(--bg-primary);
  border: 3px solid var(--border-color);
  box-shadow: var(--shadow-xl);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.search-header {
  display: flex;
  align-items: center;
  padding: var(--spacing-md);
  border-bottom: 2px solid var(--border-color);
}

.search-input {
  flex: 1;
  padding: var(--spacing-md);
  font-size: var(--text-lg);
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-color);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  padding: 0 var(--spacing-sm);
  line-height: 1;
}

.search-results {
  max-height: 50vh;
  overflow-y: auto;
}

.result-section {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--bg-secondary);
}

.result-section:last-child {
  border-bottom: none;
}

.result-section h4 {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
  text-transform: uppercase;
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  cursor: pointer;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
}

.result-item:hover,
.result-item.active,
.result-item:focus-visible {
  background: var(--bg-secondary);
  outline: none;
}

.result-icon {
  font-size: 1.2rem;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-title {
  display: block;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-meta {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.no-results,
.search-loading {
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--text-muted);
}

.search-footer {
  padding: var(--spacing-md);
  border-top: 2px solid var(--border-color);
  text-align: center;
}

.hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
