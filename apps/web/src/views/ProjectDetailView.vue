<template>
  <div class="project-detail-view container">
    <div v-if="loading && !project" class="loading">Loading project…</div>

    <div v-else-if="project" class="project-content">
      <div class="page-header">
        <div>
          <router-link to="/projects" class="back-link">← Back to Projects</router-link>
          <h1 class="page-title">{{ project.name }}</h1>
          <p v-if="project.description" class="text-muted">{{ project.description }}</p>
        </div>
        <div class="project-actions">
          <span :class="['badge', getStatusClass(project.status)]">{{ project.status }}</span>
          <span v-if="canEdit" :class="['badge', getStatusClass('planning')]">
            <UserAvatar v-if="project.creator" :src="project.creator.avatar_url" :name="project.creator.display_name || project.creator.username" size="xs" />
            <span class="ml-xs">{{ project.creator?.display_name || project.creator?.username }}</span>
          </span>
          <button v-if="canEdit" class="btn btn-secondary" @click="showTaskModal = true">+ Add Task</button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat">
          <span class="stat-value">{{ project.task_stats?.total ?? 0 }}</span>
          <span class="stat-label">Tasks</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ project.task_stats?.done ?? 0 }}</span>
          <span class="stat-label">Done</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ progressPct }}%</span>
          <span class="stat-label">Progress</span>
        </div>
      </div>

      <div class="tasks-section">
        <h2 class="section-title">Tasks</h2>

        <div v-if="tasksLoading && projectTasks.length === 0" class="loading">Loading tasks…</div>

        <div v-else-if="projectTasks.length === 0" class="empty-state">
          <p>No tasks yet.</p>
          <button v-if="canEdit" class="btn btn-primary" @click="showTaskModal = true">Add the first task</button>
        </div>

        <div v-else class="task-board">
          <div v-for="column in taskColumns" :key="column.status" class="task-column">
            <h3 class="column-header">
              {{ column.label }} ({{ getTasksByStatus(column.status).length }})
            </h3>
            <div class="task-list">
              <article
                v-for="task in getTasksByStatus(column.status)"
                :key="task.id"
                class="task-card card"
              >
                <div class="task-title">{{ task.title }}</div>
                <div v-if="task.due_date" class="task-due">Due: {{ formatDate(task.due_date) }}</div>
                <div v-if="task.assignees_list?.length" class="task-assignees">
                  <UserAvatar
                    v-for="assignee in task.assignees_list.slice(0, 3)"
                    :key="assignee.id"
                    :src="assignee.avatar_url"
                    :name="assignee.display_name || assignee.username"
                    size="xs"
                  />
                </div>
                <div v-if="canEdit" class="task-actions">
                  <select
                    :value="task.status"
                    @change="(e) => onMove(task.id, (e.target as HTMLSelectElement).value)"
                    :aria-label="`Change status of ${task.title}`"
                  >
                    <option v-for="c in taskColumns" :key="c.status" :value="c.status">{{ c.label }}</option>
                    <option value="blocked">Blocked</option>
                  </select>
                  <button class="link-btn" @click="onDelete(task.id)">Delete</button>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>Project not found.</p>
      <router-link to="/projects" class="btn btn-primary">Back to Projects</router-link>
    </div>

    <div v-if="showTaskModal" class="modal-overlay" @click.self="closeTaskModal">
      <div class="modal-content card" role="dialog" aria-modal="true" aria-labelledby="add-task-title">
        <div class="card-header">
          <h3 id="add-task-title">Add New Task</h3>
          <button class="close-btn" @click="closeTaskModal" aria-label="Close">×</button>
        </div>
        <form class="card-body" @submit.prevent="createTask">
          <div class="form-group">
            <label for="task-title" class="label">Task Title *</label>
            <input id="task-title" v-model.trim="newTask.title" type="text" class="input" required maxlength="200" />
          </div>
          <div class="form-group">
            <label for="task-desc" class="label">Description</label>
            <textarea id="task-desc" v-model="newTask.description" class="input textarea" rows="3" maxlength="2000"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="task-priority" class="label">Priority</label>
              <select id="task-priority" v-model="newTask.priority" class="input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div class="form-group">
              <label for="task-due" class="label">Due date</label>
              <input id="task-due" v-model="newTask.due_date" type="date" class="input" />
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="closeTaskModal">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="creating || !newTask.title">
              {{ creating ? 'Creating…' : 'Add Task' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectsStore } from '../stores/projects'
import { useTasksStore, type TaskStatus } from '../stores/tasks'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'
import UserAvatar from '../components/UserAvatar.vue'

const route = useRoute()
const projectsStore = useProjectsStore()
const tasksStore = useTasksStore()
const authStore = useAuthStore()
const uiStore = useUIStore()

const showTaskModal = ref(false)
const creating = ref(false)

const newTask = ref<{
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string
}>({
  title: '',
  description: '',
  priority: 'medium',
  due_date: ''
})

const taskColumns: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' }
]

const project = computed(() => projectsStore.currentProject)
const loading = computed(() => projectsStore.loading)
const tasksLoading = computed(() => tasksStore.loading)
const canEdit = computed(() => {
  const u = authStore.userId
  return !!u && project.value?.created_by === u
})

const projectTasks = computed(() => {
  const id = route.params.id as string
  return tasksStore.tasksByProject[id] ?? []
})

const progressPct = computed(() => {
  const stats = project.value?.task_stats
  if (!stats || !stats.total) return 0
  return Math.round((stats.done / stats.total) * 100)
})

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

function getTasksByStatus(status: TaskStatus) {
  return projectTasks.value.filter((t) => t.status === status)
}

function formatDate(dateString: string) {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString()
}

function closeTaskModal() {
  showTaskModal.value = false
  newTask.value = { title: '', description: '', priority: 'medium', due_date: '' }
}

async function createTask() {
  const id = project.value?.id
  if (!id || !newTask.value.title.trim()) return
  creating.value = true
  const result = await tasksStore.createTask({
    project_id: id,
    title: newTask.value.title,
    description: newTask.value.description || undefined,
    priority: newTask.value.priority,
    due_date: newTask.value.due_date || null
  })
  creating.value = false
  if (result.success) {
    uiStore.showSuccess('Task created')
    closeTaskModal()
  } else {
    uiStore.showError(result.error || 'Failed to create task')
  }
}

async function onMove(taskId: string, newStatus: string) {
  const result = await tasksStore.moveTask(taskId, newStatus as TaskStatus)
  if (!result.success) uiStore.showError(result.error || 'Move failed')
}

async function onDelete(taskId: string) {
  const ok = await uiStore.confirm('Delete this task?')
  if (!ok) return
  const result = await tasksStore.deleteTask(taskId)
  if (result.success) uiStore.showSuccess('Task deleted')
  else uiStore.showError(result.error || 'Delete failed')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showTaskModal.value) closeTaskModal()
}

onMounted(async () => {
  const projectId = route.params.id as string
  await projectsStore.fetchProject(projectId)
  await tasksStore.fetchTasks(projectId)
  tasksStore.subscribeToProject(projectId)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
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
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
}
.back-link {
  color: var(--accent-color);
  text-decoration: none;
  font-size: var(--text-sm);
  display: block;
  margin-bottom: var(--spacing-sm);
}
.page-title {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0 0 var(--spacing-xs) 0;
}
.project-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}
.stats-row {
  display: flex;
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) 0;
  border-top: 2px solid var(--border-color);
  border-bottom: 2px solid var(--border-color);
}
.stat { text-align: left; }
.stat-value { display: block; font-size: 1.5rem; font-weight: bold; }
.stat-label { font-size: var(--text-sm); color: var(--text-muted); text-transform: uppercase; }

.section-title {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0 0 var(--spacing-md) 0;
}
.task-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-md);
}
.task-column {
  background: var(--bg-secondary);
  padding: var(--spacing-md);
  min-height: 200px;
}
.column-header {
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--text-sm);
  text-transform: uppercase;
}
.task-list { display: flex; flex-direction: column; gap: var(--spacing-sm); }
.task-card { padding: var(--spacing-md); display: flex; flex-direction: column; gap: var(--spacing-xs); }
.task-title { font-weight: bold; }
.task-due { font-size: var(--text-sm); color: var(--text-muted); }
.task-assignees { display: flex; gap: -8px; }
.task-assignees > * { margin-right: -8px; }
.task-actions { display: flex; gap: var(--spacing-sm); align-items: center; margin-top: var(--spacing-xs); }
.task-actions select {
  flex: 1;
  padding: var(--spacing-xs);
  border: 2px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-color);
  font-size: var(--text-xs);
}
.link-btn {
  background: none;
  border: none;
  color: var(--error-color);
  cursor: pointer;
  font-size: var(--text-xs);
  text-decoration: underline;
}
.empty-state, .loading {
  text-align: center;
  padding: var(--spacing-xl);
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
.ml-xs { margin-left: var(--spacing-xs); }

@media (max-width: 1024px) { .task-board { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) {
  .task-board { grid-template-columns: 1fr; }
  .form-row { grid-template-columns: 1fr; }
}
</style>
