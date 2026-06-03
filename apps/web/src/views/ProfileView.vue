<template>
  <div class="profile-view container">
    <div v-if="!profile" class="loading">Loading profile…</div>

    <template v-else>
      <div class="profile-header card">
        <div class="card-body">
          <UserAvatar :src="profile.avatar_url" :name="profile.display_name || profile.username" size="xl" />
          <h1 class="profile-name">{{ profile.display_name || profile.username }}</h1>
          <p class="text-muted">@{{ profile.username }}</p>
          <p v-if="profile.bio" class="bio">{{ profile.bio }}</p>
          <p class="text-muted text-sm">Role: {{ profile.role }}</p>

          <button
            v-if="isSelf && !editing"
            class="btn btn-primary mt-md"
            @click="enterEdit"
          >
            Edit Profile
          </button>
        </div>
      </div>

      <div v-if="editing" class="card mt-xl">
        <div class="card-header"><h3>Edit Profile</h3></div>
        <div class="card-body">
          <div class="form-group">
            <label for="edit-display" class="label">Display Name</label>
            <input id="edit-display" v-model="form.display_name" type="text" class="input" maxlength="80" />
          </div>
          <div class="form-group">
            <label for="edit-bio" class="label">Bio</label>
            <textarea id="edit-bio" v-model="form.bio" class="input textarea" rows="3" maxlength="500"></textarea>
          </div>
          <div class="form-group">
            <label for="edit-avatar" class="label">Avatar URL</label>
            <input id="edit-avatar" v-model="form.avatar_url" type="url" class="input" />
          </div>
          <div v-if="editError" class="error-text">{{ editError }}</div>
          <div class="form-actions">
            <button class="btn btn-secondary" @click="cancelEdit">Cancel</button>
            <button class="btn btn-primary" :disabled="saving" @click="saveEdit">
              {{ saving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>

      <div class="card mt-xl">
        <div class="card-header"><h3>Activity</h3></div>
        <div class="card-body">
          <div class="stats-grid">
            <div class="stat">
              <span class="stat-value">{{ stats.projects }}</span>
              <span class="stat-label">Projects</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ stats.tasks }}</span>
              <span class="stat-label">Open Tasks</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ stats.crews }}</span>
              <span class="stat-label">Crews</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ stats.docs }}</span>
              <span class="stat-label">Documents</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore, type Profile } from '../stores/auth'
import { useUIStore } from '../stores/ui'
import { supabase } from '../lib/supabase'
import UserAvatar from '../components/UserAvatar.vue'

const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUIStore()

const profile = ref<Profile | null>(null)
const stats = ref({ projects: 0, tasks: 0, crews: 0, docs: 0 })

const editing = ref(false)
const saving = ref(false)
const editError = ref('')
const form = ref({ display_name: '', bio: '', avatar_url: '' })

const targetUserId = computed(() => (route.params.id as string) || authStore.userId || '')
const isSelf = computed(() => targetUserId.value === authStore.userId)

async function loadProfile() {
  const userId = targetUserId.value
  if (!userId) {
    profile.value = null
    return
  }
  if (isSelf.value && authStore.profile) {
    profile.value = authStore.profile
  } else {
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (fetchError) {
      console.error('Profile fetch failed:', fetchError)
      profile.value = null
      return
    }
    profile.value = (data ?? null) as Profile | null
  }
  if (profile.value) loadStats(userId)
}

async function loadStats(userId: string) {
  try {
    const [projRes, taskRes, crewRes, docRes] = await Promise.all([
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('created_by', userId).is('deleted_at', null),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).contains('assignees', [userId]).is('deleted_at', null).neq('status', 'done'),
      supabase.from('crew_members').select('crew_id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('created_by', userId)
    ])
    stats.value = {
      projects: projRes.count ?? 0,
      tasks: taskRes.count ?? 0,
      crews: crewRes.count ?? 0,
      docs: docRes.count ?? 0
    }
  } catch (e) {
    console.error('Stats fetch failed:', e)
  }
}

function enterEdit() {
  if (!profile.value) return
  form.value = {
    display_name: profile.value.display_name ?? '',
    bio: profile.value.bio ?? '',
    avatar_url: profile.value.avatar_url ?? ''
  }
  editError.value = ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  editError.value = ''
}

async function saveEdit() {
  saving.value = true
  editError.value = ''
  const result = await authStore.updateProfile({
    display_name: form.value.display_name || undefined,
    bio: form.value.bio || undefined,
    avatar_url: form.value.avatar_url || undefined
  })
  saving.value = false
  if (result.success) {
    profile.value = authStore.profile
    editing.value = false
    uiStore.showSuccess('Profile updated')
  } else {
    editError.value = result.error || 'Update failed'
  }
}

onMounted(loadProfile)
watch(() => route.params.id, loadProfile)
</script>

<style scoped>
.profile-view { padding: var(--spacing-xl) 0; }
.profile-header { text-align: center; }
.profile-name { font-size: 1.5rem; font-weight: 800; margin: var(--spacing-md) 0 var(--spacing-xs); }
.bio { max-width: 600px; margin: var(--spacing-sm) auto; }
.text-muted { color: var(--text-muted); }
.text-sm { font-size: var(--text-sm); }
.mt-md { margin-top: var(--spacing-md); }
.mt-xl { margin-top: var(--spacing-xl); }
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--spacing-lg);
}
.stat { text-align: center; }
.stat-value { display: block; font-size: 1.5rem; font-weight: bold; color: var(--accent-color); }
.stat-label { font-size: var(--text-sm); color: var(--text-muted); text-transform: uppercase; }
.loading { text-align: center; padding: var(--spacing-2xl); color: var(--text-muted); }
.form-group { margin-bottom: var(--spacing-md); }
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
.form-actions { display: flex; gap: var(--spacing-md); justify-content: flex-end; }
.error-text { color: var(--error-color); font-size: var(--text-sm); margin-bottom: var(--spacing-sm); }
</style>
