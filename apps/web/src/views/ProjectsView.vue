<template>
  <div class="projects-view container">
    <div class="page-header">
      <h1 class="text-2xl font-display">PROJECTS</h1>
      <button class="btn btn-primary" @click="showCreateModal = true">+ New Project</button>
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
    </div>

    <div v-if="loading" class="loading">Loading projects...</div>
    
    <div v-else-if="projects.length === 0" class="empty-state">
      <p>No projects found. Create your first project!</p>
      <button class="btn btn-primary" @click="showCreateModal = true">Create Project</button>
    </div>

    <div v-else class="projects-grid">
      <router-link 
        v-for="project in projects" 
        :key="project.id"
        :to="`/projects/${project.id}`"
        class="project-card card"
      >
        <div class="card-header">
          <h3>{{ project.name }}</h3>
          <span :class="['badge', getStatusClass(project.status)]">{{ project.status }}</span>
        </div>
        <div class="card-body">
          <p v-if="project.description">{{ project.description }}</p>
          <div class="project-meta">
            <span v-if="project.crew">Crew: {{ project.crew.name }}</span>
            <span>Tasks: {{ project.task_stats?.total || 0 }}</span>
            <span>{{ formatDate(project.created_at) }}</span>
          </div>
        </div>
      </router-link>
    </div>

    <!-- Create Project Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal-content card">
        <div class="card-header">
          <h3>Create New Project</h3>
          <button class="close-btn" @click="showCreateModal = false">×</button>
        </div>
        <form class="card-body" @submit.prevent="createProject">
          <div class="form-group">
            <label class="label">Project Name *</label>
            <input v-model="newProject.name" type="text" class="input" required />
          </div>
          <div class="form-group">
            <label class="label">Description</label>
            <textarea v-model="newProject.description" class="input textarea" rows="3"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="showCreateModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="creating">
              {{ creating ? 'Creating...' : 'Create Project' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProjectsStore } from '../stores/projects'
import { useUIStore } from '../stores/ui'

const projectsStore = useProjectsStore()
const uiStore = useUIStore()

const showCreateModal = ref(false)
const creating = ref(false)
const currentFilter = ref('all')

const newProject = ref({
  name: '',
  description: ''
})

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Planning', value: 'planning' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' }
]

const loading = computed(() => projectsStore.loading)
const projects = computed(() => {
  if (currentFilter.value === 'all') {
    return projectsStore.projects
  }
  return projectsStore.projects.filter(p => p.status === currentFilter.value)
})

async function createProject() {
  if (!newProject.value.name.trim()) return
  
  creating.value = true
  const result = await projectsStore.createProject({
    name: newProject.value.name,
    description: newProject.value.description || undefined
  })
  
  if (result.success) {
    showCreateModal.value = false
    newProject.value = { name: '', description: '' }
    uiStore.showSuccess('Project created successfully!')
  } else {
    uiStore.showError(result.error || 'Failed to create project')
  }
  creating.value = false
}

function getStatusClass(status: string) {
  const classes: Record<string, string> = {
    planning: 'badge-info',
    active: 'badge-success',
    on_hold: 'badge-warning',
    completed: ''
  }
  return classes[status] || ''
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString()
}

onMounted(() => {
  projectsStore.fetchProjects()
})
</script>

<style scoped>
.projects-view {
  padding: var(--spacing-xl) 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
}

.filters {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.filter-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 2px solid var(--border-color);
  background: transparent;
  cursor: pointer;
  font-weight: bold;
  text-transform: uppercase;
}

.filter-btn.active {
  background: var(--accent-color);
  color: var(--bg-primary);
  border-color: var(--accent-color);
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-xl);
}

.project-card {
  text-decoration: none;
  color: var(--text-color);
}

.project-meta {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: var(--spacing-md);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-3xl);
}

.loading {
  text-align: center;
  padding: var(--spacing-xl);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal, 200);
}

.modal-content {
  width: 100%;
  max-width: 500px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

.label {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-weight: bold;
  text-transform: uppercase;
  font-size: var(--text-sm);
}

.input {
  width: 100%;
  padding: var(--spacing-md);
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
}

.textarea {
  resize: vertical;
}

.form-actions {
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
}
</style>