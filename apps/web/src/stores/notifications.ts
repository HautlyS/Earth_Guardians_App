/**
 * Notifications Store
 * Earth Guardians Platform
 */
import { defineStore } from 'pinia'
import { ref, computed, onScopeDispose } from 'vue'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string | null
  type: string | null
  is_read: boolean
  data?: Record<string, unknown> | null
  created_at: string
}

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const unreadCount = computed(() => notifications.value.filter((n) => !n.is_read).length)

  let channel: RealtimeChannel | null = null

  async function fetchNotifications(limit = 50): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (fetchError) throw fetchError
      notifications.value = (data ?? []) as Notification[]
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch notifications'
    } finally {
      loading.value = false
    }
  }

  async function markAsRead(notificationId: string): Promise<void> {
    const idx = notifications.value.findIndex((n) => n.id === notificationId)
    if (idx === -1) return
    notifications.value[idx].is_read = true
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
      if (updateError) {
        notifications.value[idx].is_read = false
        console.error('Mark as read failed:', updateError)
      }
    } catch (e) {
      notifications.value[idx].is_read = false
      console.error('Mark as read failed:', e)
    }
  }

  async function markAllAsRead(): Promise<void> {
    const unreadIds = notifications.value.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return
    notifications.value = notifications.value.map((n) => ({ ...n, is_read: true }))
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds)
      if (updateError) console.error('Mark all as read failed:', updateError)
    } catch (e) {
      console.error('Mark all as read failed:', e)
    }
  }

  async function deleteNotification(notificationId: string): Promise<void> {
    const prev = notifications.value
    notifications.value = notifications.value.filter((n) => n.id !== notificationId)
    try {
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
      if (deleteError) {
        notifications.value = prev
        console.error('Delete notification failed:', deleteError)
      }
    } catch (e) {
      notifications.value = prev
      console.error('Delete notification failed:', e)
    }
  }

  function add(notification: Notification): void {
    if (notifications.value.some((n) => n.id === notification.id)) return
    notifications.value.unshift(notification)
  }

  function subscribeToRealtime(userId: string): void {
    if (channel) return
    channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          add(payload.new as Notification)
        }
      )
      .subscribe()
  }

  function unsubscribeFromRealtime(): void {
    if (channel) {
      void supabase.removeChannel(channel)
      channel = null
    }
  }

  function clear(): void {
    notifications.value = []
  }

  onScopeDispose(() => unsubscribeFromRealtime())

  return {
    notifications,
    loading,
    error,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    add,
    subscribeToRealtime,
    unsubscribeFromRealtime,
    clear,
  }
})
