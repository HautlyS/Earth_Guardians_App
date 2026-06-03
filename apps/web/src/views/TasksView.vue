<template>
  <div class="tasks-view container">
    <div class="page-header">
      <h1 class="page-title">Tasks</h1>
      <p class="text-muted">Tasks assigned to you across all projects.</p>
    </div>

    <div class="filters">
      <button
        v-for="filter in filters"
        :key="filter.value"
        :class="['filter-btn', { active: tasksStore.filter === filter.value }]"
        @click="setFilter(filter.value)"
      >
        {{ filter.label }} ({{ countFor(filter.value) }})
      </button>
    </div>

    <div v-if="tasksStore.loading" class="loading">Loading tasks…</div>

    <div v-else-if="visibleTasks.length === 0" class="empty-state">
      <p>No tasks match this filter.</p>
    </div>

    <div v-else class="task-board">
      <div v-for="column in columns" :key="column.status" class="task-column">
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
            <div v-if="task.description" class="task-desc">{{ task.description }}</div>
            <div class="task-meta">
              <span v-if="task.due_date" class="due">Due: {{ formatDate(task.due_date) }}</span>
              <span v-else class="due muted">No due date</span>
              <span :class="['badge', getPriorityClass(task.priority)]">{{ task.priority || 'medium' }}</span>
            </div>
            <div class="task-actions">
              <select
                :value="task.status"
                @change="(e) => onMove(task.id, (e.target as HTMLSelectElement).value)"
                :aria-label="`Change status of ${task.title}`"
              >
                <option v-for="c in columns" :key="c.status" :value="c.status">{{ c.label }}</option>
                <option value="blocked">Blocked</option>
              </select>
              <button class="link-btn" @click="onDelete(task.id)" :aria-label="`Delete ${task.title}`">
                Delete
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTasksStore, type TaskStatus } from '../stores/tasks'
import { useUIStore } from '../stores/ui'

const tasksStore = useTasksStore()
const uiStore = useUIStore()

const columns: { status: TaskStatus; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' }
]

const filters: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  ...columns
]

const visibleTasks = computed(() => {
  if (tasksStore.filter === 'all') return tasksStore.tasks
  return tasksStore.tasks.filter((t) => t.status === tasksStore.filter)
})

function setFilter(value: TaskStatus | 'all') {
  tasksStore.filter = value
}

function countFor(value: TaskStatus | 'all') {
  if (value === 'all') return tasksStore.tasks.length
  return tasksStore.tasks.filter((t) => t.status === value).length
}

function getTasksByStatus(status: TaskStatus) {
  return visibleTasks.value.filter((t) => t.status === status)
}

function getPriorityClass(priority?: string) {
  const classes: Record<string, string> = {
    high: 'badge-error',
    urgent: 'badge-error',
    medium: 'badge-warning',
    low: 'badge-info'
  }
  return classes[priority || 'medium'] || ''
}

function formatDate(dateString: string) {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString()
}

async function onMove(taskId: string, newStatus: string) {
  const result = await tasksStore.moveTask(taskId, newStatus as TaskStatus)
  if (!result.success) uiStore.showError(result.error || 'Move failed')
}

async function onDelete(taskId: string) {
  const ok = await uiStore.confirm('Delete this task?')
  if (!ok) return
  const result = await tasksStore.deleteTask(taskId)
  if (!result.success) uiStore.showError(result.error || 'Delete failed')
  else uiStore.showSuccess('Task deleted')
}

onMounted(async () => {
  await tasksStore.fetchAllUserTasks()
})
</script>

<style scoped>
.tasks-view { padding: var(--spacing-xl) 0; }
.page-header { margin-bottom: var(--spacing-lg); }
.page-title { font-size: 1.5rem; font-weight: 800; margin: 0; }

.filters {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-lg);
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

.task-board {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
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
.task-card { padding: var(--spacing-md); display: flex; flex-direction: column; gap: var(--spacing-sm); }
.task-title { font-weight: bold; }
.task-desc { font-size: var(--text-sm); color: var(--text-muted); }
.task-meta { display: flex; justify-content: space-between; align-items: center; font-size: var(--text-sm); }
.due { color: var(--text-muted); }
.due.muted { opacity: 0.6; }
.task-actions { display: flex; gap: var(--spacing-sm); align-items: center; }
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

@media (max-width: 1024px) { .task-board { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 768px) { .task-board { grid-template-columns: 1fr; } }
</style>
