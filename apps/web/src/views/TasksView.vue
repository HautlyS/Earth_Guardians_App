<template>
  <div class="tasks-view container">
    <div class="page-header">
      <h1 class="text-2xl font-display">TASKS</h1>
    </div>

    <div v-if="tasksStore.loading" class="loading">Loading tasks...</div>
    
    <div v-else class="task-board">
      <div v-for="column in columns" :key="column.status" class="task-column">
        <h3 class="column-header">{{ column.label }} ({{ getTasksByStatus(column.status).length }})</h3>
        <div class="task-list">
          <div 
            v-for="task in getTasksByStatus(column.status)" 
            :key="task.id"
            class="task-card card"
          >
            <div class="task-title">{{ task.title }}</div>
            <div v-if="task.description" class="task-desc">{{ task.description }}</div>
            <div class="task-meta">
              <span v-if="task.due_date">Due: {{ formatDate(task.due_date) }}</span>
              <span :class="['badge', getPriorityClass(task.priority)]">{{ task.priority }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTasksStore } from '../stores/tasks'
import { onMounted } from 'vue'

const tasksStore = useTasksStore()

const columns = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'todo', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'review', label: 'Review' },
  { status: 'done', label: 'Done' }
]

function getTasksByStatus(status: string) {
  return tasksStore.tasks.filter(t => t.status === status)
}

function getPriorityClass(priority?: string) {
  const classes: Record<string, string> = {
    high: 'badge-error',
    medium: 'badge-warning',
    low: 'badge-info'
  }
  return classes[priority || 'medium'] || ''
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString()
}

onMounted(() => {
  tasksStore.clearTasks()
})
</script>

<style scoped>
.tasks-view { padding: var(--spacing-xl) 0; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-xl); }
.task-board { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--spacing-lg); }
.task-column { background: var(--bg-secondary); padding: var(--spacing-md); }
.column-header { margin: 0 0 var(--spacing-md) 0; font-size: var(--text-sm); text-transform: uppercase; }
.task-list { display: flex; flex-direction: column; gap: var(--spacing-sm); }
.task-card { padding: var(--spacing-md); cursor: pointer; }
.task-title { font-weight: bold; }
.task-desc { font-size: var(--text-sm); color: var(--text-muted); margin-top: var(--spacing-xs); }
.task-meta { display: flex; justify-content: space-between; font-size: var(--text-sm); color: var(--text-muted); margin-top: var(--spacing-sm); }
.empty-state, .loading { text-align: center; padding: var(--spacing-xl); }

@media (max-width: 1024px) { .task-board { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 768px) { .task-board { grid-template-columns: 1fr; } }
</style>