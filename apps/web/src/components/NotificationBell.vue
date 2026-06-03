<template>
  <div class="notification-bell">
    <button class="bell-btn" @click="toggleNotifications">
      🔔
      <span v-if="unreadCount > 0" class="badge">{{ displayCount }}</span>
    </button>

    <div v-if="isOpen" class="notifications-dropdown">
      <div class="dropdown-header">
        <h3>Notifications</h3>
        <button v-if="unreadCount > 0" class="mark-read-btn" @click="markAllRead">
          Mark all read
        </button>
      </div>

      <div class="notifications-list" v-if="notifications.length > 0">
        <div 
          v-for="notification in notifications" 
          :key="notification.id"
          :class="['notification-item', { unread: !notification.is_read }]"
          @click="handleNotificationClick(notification)"
        >
          <div class="notification-content">
            <p class="notification-title">{{ notification.title }}</p>
            <p v-if="notification.body" class="notification-body">{{ notification.body }}</p>
            <span class="notification-time">{{ formatTime(notification.created_at) }}</span>
          </div>
        </div>
      </div>

      <div v-else class="empty-notifications">
        <p>No notifications yet</p>
      </div>

      <div class="dropdown-footer">
        <router-link to="/notifications" class="view-all">View all</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore, type Notification } from '../stores/notifications'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const notificationsStore = useNotificationsStore()
const authStore = useAuthStore()

const isOpen = ref(false)

const notifications = computed(() => notificationsStore.notifications.slice(0, 5))
const unreadCount = computed(() => notificationsStore.unreadCount)
const displayCount = computed(() => unreadCount.value > 99 ? '99+' : unreadCount.value)

function toggleNotifications() {
  isOpen.value = !isOpen.value
  if (isOpen.value && notifications.value.length === 0) {
    notificationsStore.fetchNotifications()
  }
}

async function markAllRead() {
  await notificationsStore.markAllAsRead()
}

function handleNotificationClick(notification: Notification) {
  notificationsStore.markAsRead(notification.id)
  if (notification.data?.task_id) {
    router.push(`/tasks/${notification.data.task_id}`)
  }
  isOpen.value = false
}

function formatTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.notification-bell')) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  if (authStore.userId) {
    notificationsStore.fetchNotifications()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
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
}

.bell-btn:hover {
  background: var(--bg-secondary);
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

.notifications-list {
  max-height: 400px;
  overflow-y: auto;
}

.notification-item {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--bg-secondary);
  cursor: pointer;
}

.notification-item:hover {
  background: var(--bg-secondary);
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

.dropdown-footer {
  padding: var(--spacing-md);
  text-align: center;
  border-top: 1px solid var(--border-color);
}

.view-all {
  color: var(--accent-color);
  text-decoration: none;
}
</style>