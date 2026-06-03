<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="search-modal">
      <div class="search-header">
        <input 
          ref="searchInput"
          v-model="query" 
          type="text" 
          placeholder="Search projects, tasks, docs, users..."
          class="search-input"
          @keydown.enter="performSearch"
          @keydown.esc="$emit('close')"
        />
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="search-results" v-if="results">
        <div v-if="results.projects?.length" class="result-section">
          <h4>Projects</h4>
          <div v-for="project in results.projects" :key="project.id" class="result-item" @click="goTo(`/projects/${project.id}`)">
            <span class="result-icon">📁</span>
            <div class="result-content">
              <span class="result-title">{{ project.name }}</span>
              <span class="result-meta">{{ project.status }}</span>
            </div>
          </div>
        </div>

        <div v-if="results.tasks?.length" class="result-section">
          <h4>Tasks</h4>
          <div v-for="task in results.tasks" :key="task.id" class="result-item" @click="goTo(`/tasks?task=${task.id}`)">
            <span class="result-icon">✓</span>
            <div class="result-content">
              <span class="result-title">{{ task.title }}</span>
              <span class="result-meta">{{ task.status }}</span>
            </div>
          </div>
        </div>

        <div v-if="results.users?.length" class="result-section">
          <h4>Users</h4>
          <div v-for="user in results.users" :key="user.id" class="result-item" @click="goTo(`/profile/${user.id}`)">
            <UserAvatar :src="user.avatar_url" :name="user.display_name || user.username" size="sm" />
            <div class="result-content">
              <span class="result-title">{{ user.display_name || user.username }}</span>
              <span class="result-meta">{{ user.role }}</span>
            </div>
          </div>
        </div>

        <div v-if="!hasResults" class="no-results">
          <p>No results found for "{{ query }}"</p>
        </div>
      </div>

      <div v-if="loading" class="search-loading">
        <span>Searching...</span>
      </div>

      <div class="search-footer">
        <span class="hint">Press Enter to search, Esc to close</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import UserAvatar from './UserAvatar.vue'

const emit = defineEmits(['close'])

const router = useRouter()
const searchInput = ref<HTMLInputElement | null>(null)
const query = ref('')
const results = ref<any>(null)
const loading = ref(false)

const hasResults = computed(() => {
  return results.value && (
    results.value.projects?.length > 0 ||
    results.value.tasks?.length > 0 ||
    results.value.users?.length > 0 ||
    results.value.documents?.length > 0
  )
})

watch(query, (newQuery) => {
  if (newQuery.length >= 2) {
    debouncedSearch()
  } else {
    results.value = null
  }
})

let searchTimeout: number
function debouncedSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(performSearch, 300) as unknown as number
}

async function performSearch() {
  if (query.value.length < 2) return
  
  loading.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const searchPattern = `%${query.value}%`
    
    // Search projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, status')
      .is('deleted_at', null)
      .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
      .limit(5)

    // Search tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, status')
      .is('deleted_at', null)
      .contains('assignees', [user.id])
      .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
      .limit(5)

    // Search users
    const { data: users } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .or(`username.ilike.${searchPattern},display_name.ilike.${searchPattern}`)
      .limit(5)

    results.value = { projects, tasks, users }
  } catch (e) {
    console.error('Search failed:', e)
  } finally {
    loading.value = false
  }
}

function goTo(path: string) {
  router.push(path)
  emit('close')
}

onMounted(() => {
  searchInput.value?.focus()
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
}

.search-results {
  max-height: 400px;
  overflow-y: auto;
}

.result-section {
  padding: var(--spacing-md);
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
}

.result-item:hover {
  background: var(--bg-secondary);
}

.result-icon {
  font-size: 1.2rem;
}

.result-content {
  flex: 1;
}

.result-title {
  display: block;
  font-weight: bold;
}

.result-meta {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.no-results {
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--text-muted);
}

.search-loading {
  padding: var(--spacing-xl);
  text-align: center;
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