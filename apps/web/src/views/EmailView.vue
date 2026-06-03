<template>
  <div class="email-view container">
    <h1 class="page-title">Email</h1>
    <p class="text-muted">Internal messaging system.</p>

    <div class="email-layout mt-xl">
      <aside class="email-folders">
        <button
          v-for="f in folders"
          :key="f.value"
          :class="['folder-btn', { active: folder === f.value }]"
          @click="setFolder(f.value)"
        >
          {{ f.label }}
        </button>
      </aside>

      <section class="email-list">
        <div v-if="loading" class="loading">Loading…</div>
        <div v-else-if="messages.length === 0" class="empty-state">
          <p>No messages in {{ folder }}.</p>
        </div>
        <ul v-else class="messages">
          <li
            v-for="msg in messages"
            :key="msg.id"
            :class="['message-item', { unread: !msg.is_read }]"
            @click="openMessage(msg.id)"
          >
            <div class="message-row">
              <span class="from">{{ msg.from_display || 'Unknown' }}</span>
              <span class="subject">{{ msg.subject || '(no subject)' }}</span>
            </div>
            <div class="message-meta">
              <span v-if="msg.is_starred" aria-label="Starred">★</span>
              <span class="time">{{ formatTime(msg.created_at) }}</span>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <p v-if="error" class="error-text mt-md" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUIStore } from '../stores/ui'
import { supabase } from '../lib/supabase'

interface EmailRow {
  id: string
  subject: string | null
  body?: string | null
  body_html?: string | null
  preview?: string | null
  is_read?: boolean
  is_starred?: boolean
  is_archived?: boolean
  is_deleted?: boolean
  has_attachments?: boolean
  created_at: string
  from_user_id?: string
  from_display?: string | null
  to_user_id?: string
  folder?: string
}

const uiStore = useUIStore()

const folder = ref<'inbox' | 'sent' | 'starred' | 'archive' | 'trash'>('inbox')
const folders: { value: typeof folder.value; label: string }[] = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'sent', label: 'Sent' },
  { value: 'starred', label: 'Starred' },
  { value: 'archive', label: 'Archive' },
  { value: 'trash', label: 'Trash' }
]

const messages = ref<EmailRow[]>([])
const loading = ref(false)
const error = ref('')

function formatTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

async function load() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    error.value = 'Sign in to view your email.'
    return
  }
  loading.value = true
  error.value = ''
  try {
    let query = supabase
      .from('email_messages')
      .select('id, subject, preview, is_read, is_starred, is_archived, is_deleted, has_attachments, created_at, from_user_id, to_user_id, folder')
      .order('created_at', { ascending: false })
      .limit(100)

    if (folder.value === 'inbox') {
      query = query.eq('to_user_id', user.id).eq('is_deleted', false)
    } else if (folder.value === 'sent') {
      query = query.eq('from_user_id', user.id).eq('is_deleted', false)
    } else if (folder.value === 'starred') {
      query = query.eq('to_user_id', user.id).eq('is_starred', true).eq('is_deleted', false)
    } else if (folder.value === 'archive') {
      query = query.eq('to_user_id', user.id).eq('is_archived', true).eq('is_deleted', false)
    } else {
      query = query.eq('to_user_id', user.id).eq('is_deleted', true)
    }

    const { data, error: fetchError } = await query
    if (fetchError) throw fetchError
    messages.value = (data ?? []) as EmailRow[]
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load email'
    messages.value = []
  } finally {
    loading.value = false
  }
}

async function openMessage(id: string) {
  await supabase.from('email_messages').update({ is_read: true }).eq('id', id).catch(() => {})
  const msg = messages.value.find((m) => m.id === id)
  if (msg) msg.is_read = true
}

function setFolder(f: typeof folder.value) {
  folder.value = f
  void load()
}

onMounted(load)
watch(folder, load)
</script>

<style scoped>
.email-view { padding: var(--spacing-xl) 0; }
.page-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
.text-muted { color: var(--text-muted); }
.mt-xl { margin-top: var(--spacing-xl); }
.mt-md { margin-top: var(--spacing-md); }
.email-layout {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: var(--spacing-md);
  min-height: 400px;
}
.email-folders {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
.folder-btn {
  text-align: left;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--border-color);
  background: transparent;
  cursor: pointer;
  font-weight: bold;
  text-transform: uppercase;
  font-size: var(--text-sm);
  color: inherit;
}
.folder-btn.active {
  background: var(--accent-color);
  color: var(--bg-primary);
  border-color: var(--accent-color);
}
.email-list {
  background: var(--bg-secondary);
  padding: var(--spacing-md);
}
.messages { list-style: none; padding: 0; margin: 0; }
.message-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}
.message-item:hover { background: var(--bg-primary); }
.message-item.unread { font-weight: bold; border-left: 3px solid var(--accent-color); }
.message-row { display: flex; gap: var(--spacing-md); flex: 1; min-width: 0; }
.from { flex: 0 0 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.subject { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.message-meta { display: flex; gap: var(--spacing-sm); color: var(--text-muted); font-size: var(--text-sm); }
.empty-state, .loading {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--text-muted);
}
.error-text { color: var(--error-color); font-size: var(--text-sm); }
@media (max-width: 768px) {
  .email-layout { grid-template-columns: 1fr; }
  .from { flex: 0 0 100px; }
}
</style>
