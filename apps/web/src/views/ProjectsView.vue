<template>
  <div class="projects-view container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Projects</h1>
        <p class="text-muted">Coordinate crews and outcomes together.</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">+ New Project</button>
    </div>

    <div class="filters">
      <button
        v-for="filter in filters"
        :key="filter.value"
        :class="['filter-btn', { active: currentFilter === filter.value }]"
        @click="currentFilter = filter.value"
      >
        {{ filter.label }}
      </button>
      <input
        v-model="searchQuery"
        type="search"
        class="search-input"
        placeholder="Search…"
        aria-label="Search projects"
        @keydown.enter="applySearch"
      />
    </div>

    <div v-if="loading" class="loading">Loading projects…</div>

    <div v-else-if="projects.length === 0" class="empty-state">
      <p>No projects found.</p>
      <button class="btn btn-primary" @click="openCreate">Create your first project</button>
    </div>

    <div v-else class="projects-grid">
      <router-link
        v-for="project in projects"
        :key="project.id"
        :to="`/projects/${project.id}`"
        class="project-card card"
      >
        <div class="card-header">
          <h3 class="card-title-text">{{ project.name }}</h3>
          <span :class="['badge', getStatusClass(project.status)]">{{ project.status }}</span>
        </div>
        <div class="card-body">
          <p v-if="project.description" class="project-desc">{{ project.description }}</p>
          <div class="project-meta">
            <span v-if="project.crew">Crew: {{ project.crew.name }}</span>
            <span>Tasks: {{ project.task_stats?.total ?? 0 }}</span>
            <span>{{ formatDate(project.created_at) }}</span>
          </div>
        </div>
      </router-link>
    </div>

    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreate">
      <div class="modal-content card" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
        <div class="card-header">
          <h3 id="create-project-title">Create New Project</h3>
          <button class="close-btn" @click="closeCreate" aria-label="Close">×</button>
        </div>
        <form class="card-body" @submit.prevent="createProject">
          <div class="form-group">
            <label for="proj-name" class="label">Project Name *</label>
            <input id="proj-name" v-model.trim="newProject.name" type="text" class="input" required maxlength="100" />
          </div>
          <div class="form-group">
            <label for="proj-desc" class="label">Description</label>
            <textarea id="proj-desc" v-model="newProject.description" class="input textarea" rows="3" maxlength="1000"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="proj-priority" class="label">Priority</label>
              <select id="proj-priority" v-model="newProject.priority" class="input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div class="form-group">
              <label for="proj-visibility" class="label">Visibility</label>
              <select id="proj-visibility" v-model="newProject.visibility" class="input">
                <option value="private">Private</option>
                <option value="team">Team</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="closeCreate">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="creating || !newProject.name">
              {{ creating ? 'Creating…' : 'Create Project' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProjectsStore, type ProjectStatus, type ProjectPriority, type ProjectVisibility } from '../stores/projects'
import { useUIStore } from '../stores/ui'

const projectsStore = useProjectsStore()
const uiStore = useUIStore()

const showCreateModal = ref(false)
const creating = ref(false)
const currentFilter = ref<'all' | ProjectStatus>('all')
const searchQuery = ref('')

const newProject = ref<{
  name: string
  description: string
  priority: ProjectPriority
  visibility: ProjectVisibility
}>({
  name: '',
  description: '',
  priority: 'medium',
  visibility: 'private'
})

const filters: { label: string; value: 'all' | ProjectStatus }[] = [
  { label: 'All', value: 'all' },
  { label: 'Planning', value: 'planning' },
  { label: 'Active', value: 'active' },
  { label: 'On Hold', value: 'on_hold' },
  { label: 'Completed', value: 'completed' }
]

const loading = computed(() => projectsStore.loading)
const projects = computed(() => {
  const all = projectsStore.projects
  if (currentFilter.value === 'all') return all
  return all.filter((p) => p.status === currentFilter.value)
})

function openCreate() {
  showCreateModal.value = true
}
function closeCreate() {
  showCreateModal.value = false
  newProject.value = { name: '', description: '', priority: 'medium', visibility: 'private' }
}

async function applySearch() {
  await projectsStore.fetchProjects({ search: searchQuery.value.trim() || undefined })
}

async function createProject() {
  if (!newProject.value.name.trim()) return
  creating.value = true
  const result = await projectsStore.createProject({
    name: newProject.value.name,
    description: newProject.value.description || undefined,
    priority: newProject.value.priority,
    visibility: newProject.value.visibility
  })
  creating.value = false
  if (result.success) {
    uiStore.showSuccess('Project created')
    closeCreate()
  } else {
    uiStore.showError(result.error || 'Failed to create project')
  }
}

function getStatusClass(status: string) {
  const classes: Record<string, string> = {
    planning: 'badge-info',
    active: 'badge-success',
    on_hold: 'badge-warning',
    completed: 'badge-secondary',
    archived: 'badge-secondary'
  }
  return classes[status] || ''
}

function formatDate(dateString: string) {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString()
}

onMounted(async () => {
  await projectsStore.fetchProjects()
  projectsStore.subscribeToChanges()
})
</script>

<style scoped>
.projects-view {
  padding: var(--spacing-xl) 0;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
}
.page-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
.filters {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
  align-items: center;
}
.filter-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--border-color);
  background: transparent;
  cursor: pointer;
  font-weight: bold;
  text-transform: uppercase;
  font-size: var(--text-sm);
}
.filter-btn.active {
  background: var(--accent-color);
  color: var(--bg-primary);
  border-color: var(--accent-color);
}
.search-input {
  flex: 1;
  min-width: 200px;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-color);
  font-size: var(--text-base);
}
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}
.project-card {
  text-decoration: none;
  color: var(--text-color);
  transition: border-color 0.15s;
}
.project-card:hover {
  border-color: var(--accent-color);
}
.card-title-text { margin: 0; font-size: 1.1rem; }
.project-desc {
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.project-meta {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: var(--spacing-sm);
}
.empty-state, .loading {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--text-muted);
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal, 200);
  padding: var(--spacing-md);
}
.modal-content {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}
.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;
}
.form-group { margin-bottom: var(--spacing-md); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); }
.label {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-weight: bold;
  text-transform: uppercase;
  font-size: var(--text-sm);
}
.input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-color);
  font-size: var(--text-base);
  font-family: inherit;
}
.input:focus { outline: none; border-color: var(--accent-color); }
.textarea { resize: vertical; }
.form-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
  margin-top: var(--spacing-md);
}
@media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }
</style>
