/**
 * Notifications Store
 * Earth Guardians Platform
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string | null
  type: string | null
  is_read: boolean
  data?: Record<string, any>
  created_at: string
}

export const useNotificationsStore = defineStore('notifications', () => {
  // State
  const notifications = ref<Notification[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const unreadCount = computed(() => notifications.value.filter(n => !n.is_read).length)

  // Actions
  async function fetchNotifications(limit = 50) {
    loading.value = true
    error.value = null

    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (fetchError) throw fetchError

      notifications.value = data || []
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch notifications'
    } finally {
      loading.value = false
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (updateError) throw updateError

      const index = notifications.value.findIndex(n => n.id === notificationId)
      if (index !== -1) {
        notifications.value[index].is_read = true
      }
    } catch (e) {
      console.error('Mark as read failed:', e)
    }
  }

  async function markAllAsRead() {
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false)

      if (updateError) throw updateError

      notifications.value.forEach(n => { n.is_read = true })
    } catch (e) {
      console.error('Mark all as read failed:', e)
    }
  }

  async function deleteNotification(notificationId: string) {
    try {
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (deleteError) throw deleteError

      notifications.value = notifications.value.filter(n => n.id !== notificationId)
    } catch (e) {
      console.error('Delete notification failed:', e)
    }
  }

  function add(notification: Notification) {
    notifications.value.unshift(notification)
  }

  function subscribeToRealtime(userId: string) {
    const channel = supabase.channel(`notifications-${userId}`)
    
    channel.on('broadcast', { event: 'new_notification' }, (payload) => {
      add(payload.payload)
    })

    channel.subscribe()

    return channel
  }

  return {
    // State
    notifications,
    loading,
    error,
    unreadCount,

    // Actions
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    add,
    subscribeToRealtime
  }
})