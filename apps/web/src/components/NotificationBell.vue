<template>
  <div class="notification-bell" ref="rootRef">
    <button
      class="bell-btn"
      @click="toggleNotifications"
      :aria-label="`Notifications, ${unreadCount} unread`"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
    >
      <span aria-hidden="true">🔔</span>
      <span v-if="unreadCount > 0" class="badge" aria-hidden="true">{{ displayCount }}</span>
    </button>

    <div v-if="isOpen" class="notifications-dropdown" role="menu">
      <div class="dropdown-header">
        <h3>Notifications</h3>
        <button
          v-if="unreadCount > 0"
          class="mark-read-btn"
          @click="markAllRead"
          :disabled="marking"
        >
          {{ marking ? 'Marking…' : 'Mark all read' }}
        </button>
      </div>

      <div class="notifications-list" v-if="notifications.length > 0">
        <button
          v-for="notification in notifications"
          :key="notification.id"
          :class="['notification-item', { unread: !notification.is_read }]"
          @click="handleNotificationClick(notification)"
          type="button"
          role="menuitem"
        >
          <div class="notification-content">
            <p class="notification-title">{{ notification.title }}</p>
            <p v-if="notification.body" class="notification-body">{{ notification.body }}</p>
            <span class="notification-time">{{ formatTime(notification.created_at) }}</span>
          </div>
        </button>
      </div>

      <div v-else class="empty-notifications">
        <p>No notifications yet</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore, type Notification } from '../stores/notifications'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const notificationsStore = useNotificationsStore()
const authStore = useAuthStore()

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const marking = ref(false)

const notifications = computed(() => notificationsStore.notifications.slice(0, 5))
const unreadCount = computed(() => notificationsStore.unreadCount)
const displayCount = computed(() => (unreadCount.value > 99 ? '99+' : String(unreadCount.value)))

function toggleNotifications() {
  isOpen.value = !isOpen.value
  if (isOpen.value && notifications.value.length === 0) {
    notificationsStore.fetchNotifications().catch((e) => console.error(e))
  }
}

async function markAllRead() {
  if (marking.value) return
  marking.value = true
  try {
    await notificationsStore.markAllAsRead()
  } finally {
    marking.value = false
  }
}

function handleNotificationClick(notification: Notification) {
  notificationsStore.markAsRead(notification.id).catch((e) => console.error(e))
  const data = (notification as unknown as { data?: { task_id?: string; project_id?: string } }).data
  if (data?.task_id) router.push(`/tasks`).catch(() => {})
  else if (data?.project_id) router.push(`/projects/${data.project_id}`).catch(() => {})
  isOpen.value = false
}

function formatTime(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return date.toLocaleDateString()
}

function onDocumentClick(e: MouseEvent) {
  if (!isOpen.value) return
  const target = e.target as Node | null
  if (target && rootRef.value && !rootRef.value.contains(target)) {
    isOpen.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) isOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
  if (authStore.userId) {
    notificationsStore.fetchNotifications().catch((e) => console.error(e))
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.notification-bell {
  position: relative;
}

.bell-btn {
  position: relative;
  background: none;
  border: 2px solid var(--border-color);
  cursor: pointer;
  padding: var(--spacing-sm);
  font-size: 1.2rem;
  line-height: 1;
}

.bell-btn:hover,
.bell-btn:focus-visible {
  background: var(--bg-secondary);
  outline: none;
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--error-color);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  font-weight: bold;
}

.notifications-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  width: 320px;
  background: var(--bg-primary);
  border: 2px solid var(--border-color);
  box-shadow: var(--shadow-lg);
  margin-top: var(--spacing-sm);
  z-index: var(--z-dropdown);
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
}

.dropdown-header h3 {
  margin: 0;
  font-size: var(--text-base);
}

.mark-read-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  font-size: var(--text-sm);
}

.mark-read-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.notifications-list {
  max-height: 400px;
  overflow-y: auto;
}

.notification-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: var(--spacing-md);
  border: none;
  border-bottom: 1px solid var(--bg-secondary);
  cursor: pointer;
  background: transparent;
  color: inherit;
  font: inherit;
}

.notification-item:hover,
.notification-item:focus-visible {
  background: var(--bg-secondary);
  outline: none;
}

.notification-item.unread {
  background: var(--bg-secondary);
  border-left: 3px solid var(--accent-color);
}

.notification-title {
  font-weight: bold;
  margin: 0 0 var(--spacing-xs) 0;
}

.notification-body {
  color: var(--text-muted);
  font-size: var(--text-sm);
  margin: 0 0 var(--spacing-xs) 0;
}

.notification-time {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.empty-notifications {
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--text-muted);
}
</style>
