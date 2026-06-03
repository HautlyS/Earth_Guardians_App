<template>
  <div class="project-detail-view container">
    <div v-if="loading" class="loading">Loading project...</div>
    
    <div v-else-if="project" class="project-content">
      <div class="page-header">
        <div>
          <router-link to="/projects" class="back-link">← Back to Projects</router-link>
          <h1 class="text-2xl font-display">{{ project.name }}</h1>
          <p v-if="project.description" class="text-muted">{{ project.description }}</p>
        </div>
        <div class="project-actions">
          <span :class="['badge', getStatusClass(project.status)]">{{ project.status }}</span>
          <button class="btn btn-secondary" @click="showTaskModal = true">+ Add Task</button>
        </div>
      </div>

      <div class="tasks-section">
        <h2 class="text-xl font-display mb-lg">TASKS</h2>
        
        <div v-if="tasksStore.loading" class="loading">Loading tasks...</div>
        
        <div v-else class="task-board">
          <div v-for="column in taskColumns" :key="column.status" class="task-column">
            <h3 class="column-header">{{ column.label }} ({{ getTasksByStatus(column.status).length }})</h3>
            <div class="task-list">
              <div 
                v-for="task in getTasksByStatus(column.status)" 
                :key="task.id"
                class="task-card card"
              >
                <div class="task-title">{{ task.title }}</div>
                <div v-if="task.due_date" class="task-due">Due: {{ formatDate(task.due_date) }}</div>
                <div v-if="task.assignees?.length" class="task-assignees">
                  <UserAvatar 
                    v-for="assignee in task.assignees_list?.slice(0, 3)" 
                    :key="assignee.id"
                    :src="assignee.avatar_url"
                    :name="assignee.display_name || assignee.username"
                    size="xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>Project not found.</p>
      <router-link to="/projects" class="btn btn-primary">Back to Projects</router-link>
    </div>

    <!-- Add Task Modal -->
    <div v-if="showTaskModal" class="modal-overlay" @click.self="showTaskModal = false">
      <div class="modal-content card">
        <div class="card-header">
          <h3>Add New Task</h3>
          <button class="close-btn" @click="showTaskModal = false">×</button>
        </div>
        <form class="card-body" @submit.prevent="createTask">
          <div class="form-group">
            <label class="label">Task Title *</label>
            <input v-model="newTask.title" type="text" class="input" required />
          </div>
          <div class="form-group">
            <label class="label">Description</label>
            <textarea v-model="newTask.description" class="input textarea" rows="3"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="showTaskModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="creating">Add Task</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectsStore } from '../stores/projects'
import { useTasksStore } from '../stores/tasks'
import { useUIStore } from '../stores/ui'
import UserAvatar from '../components/UserAvatar.vue'

const route = useRoute()
const projectsStore = useProjectsStore()
const tasksStore = useTasksStore()
const uiStore = useUIStore()

const showTaskModal = ref(false)
const creating = ref(false)

const newTask = ref({
  title: '',
  description: ''
})

const taskColumns = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' }
]

const project = computed(() => projectsStore.currentProject)
const loading = computed(() => projectsStore.loading)

async function createTask() {
  if (!newTask.value.title.trim()) return
  
  creating.value = true
  const result = await tasksStore.createTask({
    project_id: project.value?.id,
    title: newTask.value.title,
    description: newTask.value.description || undefined
  })
  
  if (result.success) {
    showTaskModal.value = false
    newTask.value = { title: '', description: '' }
    uiStore.showSuccess('Task created successfully!')
  } else {
    uiStore.showError(result.error || 'Failed to create task')
  }
  creating.value = false
}

function getTasksByStatus(status: string) {
  return tasksStore.tasks.filter(t => t.status === status)
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

onMounted(async () => {
  const projectId = route.params.id as string
  await projectsStore.fetchProject(projectId)
  await tasksStore.fetchTasks(projectId)
})
</script>

<style scoped>
.project-detail-view {
  padding: var(--spacing-xl) 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xl);
}

.back-link {
  color: var(--accent-color);
  text-decoration: none;
  font-size: var(--text-sm);
  display: block;
  margin-bottom: var(--spacing-sm);
}

.project-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.task-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-lg);
}

.task-column {
  background: var(--bg-secondary);
  padding: var(--spacing-md);
}

.column-header {
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--text-sm);
  text-transform: uppercase;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.task-card {
  padding: var(--spacing-md);
  cursor: pointer;
}

.task-title {
  font-weight: bold;
}

.task-due {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: var(--spacing-xs);
}

.task-assignees {
  display: flex;
  gap: -8px;
  margin-top: var(--spacing-sm);
}

.empty-state, .loading {
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

@media (max-width: 1024px) {
  .task-board {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .task-board {
    grid-template-columns: 1fr;
  }
}
</style>