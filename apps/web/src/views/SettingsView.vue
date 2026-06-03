<template>
  <div class="settings-view container">
    <h1 class="page-title">Settings</h1>

    <div class="card mt-xl">
      <div class="card-header"><h3>Profile</h3></div>
      <div class="card-body">
        <div class="form-group">
          <label for="set-display" class="label">Display Name</label>
          <input id="set-display" v-model="displayName" type="text" class="input" maxlength="80" />
        </div>
        <div class="form-group">
          <label for="set-bio" class="label">Bio</label>
          <textarea id="set-bio" v-model="bio" class="input textarea" rows="3" maxlength="500"></textarea>
        </div>
        <div class="form-group">
          <label for="set-avatar" class="label">Avatar URL</label>
          <input id="set-avatar" v-model="avatarUrl" type="url" class="input" />
        </div>
        <button @click="saveProfile" class="btn btn-primary" :disabled="savingProfile">
          {{ savingProfile ? 'Saving…' : 'Save Profile' }}
        </button>
      </div>
    </div>

    <div class="card mt-xl">
      <div class="card-header"><h3>Notifications</h3></div>
      <div class="card-body">
        <div class="setting-item">
          <span>Email notifications</span>
          <input type="checkbox" v-model="emailNotifications" />
        </div>
        <div class="setting-item">
          <span>Push notifications</span>
          <input type="checkbox" v-model="pushNotifications" />
        </div>
        <div class="setting-item">
          <span>Project updates</span>
          <input type="checkbox" v-model="projectUpdates" />
        </div>
        <button @click="saveNotifications" class="btn btn-primary mt-md" :disabled="savingNotif">
          {{ savingNotif ? 'Saving…' : 'Save Notification Preferences' }}
        </button>
      </div>
    </div>

    <div class="card mt-xl">
      <div class="card-header"><h3>Theme</h3></div>
      <div class="card-body">
        <ThemeSwitcher />
      </div>
    </div>

    <div class="card mt-xl">
      <div class="card-header"><h3>Danger Zone</h3></div>
      <div class="card-body">
        <button @click="exportAllData" class="btn btn-secondary mr-md">Export My Data</button>
        <button @click="onSignOut" class="btn btn-danger">Sign Out</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'
import { supabase } from '../lib/supabase'
import ThemeSwitcher from '../components/ThemeSwitcher.vue'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUIStore()

const displayName = ref(authStore.profile?.display_name || '')
const bio = ref(authStore.profile?.bio || '')
const avatarUrl = ref(authStore.profile?.avatar_url || '')
const savingProfile = ref(false)

const emailNotifications = ref(true)
const pushNotifications = ref(true)
const projectUpdates = ref(true)
const savingNotif = ref(false)

let notificationPrefId: string | null = null

watch(
  () => authStore.profile,
  (p) => {
    if (p) {
      displayName.value = p.display_name || ''
      bio.value = p.bio || ''
      avatarUrl.value = p.avatar_url || ''
    }
  }
)

async function saveProfile() {
  savingProfile.value = true
  const result = await authStore.updateProfile({
    display_name: displayName.value || undefined,
    bio: bio.value || undefined,
    avatar_url: avatarUrl.value || undefined
  })
  savingProfile.value = false
  if (result.success) uiStore.showSuccess('Profile saved')
  else uiStore.showError(result.error || 'Save failed')
}

async function loadNotificationPreferences() {
  const userId = authStore.userId
  if (!userId) return
  const { data, error: fetchError } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (fetchError) {
    console.warn('Notification prefs load failed:', fetchError)
    return
  }
  if (data) {
    notificationPrefId = (data as { id: string }).id
    const prefs = data as {
      email_enabled?: boolean
      push_enabled?: boolean
      project_updates?: boolean
    }
    emailNotifications.value = prefs.email_enabled ?? true
    pushNotifications.value = prefs.push_enabled ?? true
    projectUpdates.value = prefs.project_updates ?? true
  }
}

async function saveNotifications() {
  const userId = authStore.userId
  if (!userId) {
    uiStore.showError('Not authenticated')
    return
  }
  savingNotif.value = true
  const payload = {
    user_id: userId,
    email_enabled: emailNotifications.value,
    push_enabled: pushNotifications.value,
    project_updates: projectUpdates.value
  }
  const query = notificationPrefId
    ? supabase.from('notification_preferences').update(payload).eq('id', notificationPrefId)
    : supabase.from('notification_preferences').insert(payload)
  const { error: upsertErr } = await query
  savingNotif.value = false
  if (upsertErr) uiStore.showError(upsertErr.message)
  else {
    uiStore.showSuccess('Notification preferences saved')
    await loadNotificationPreferences()
  }
}

function exportAllData() {
  const data = {
    profile: authStore.profile,
    userId: authStore.userId,
    timestamp: new Date().toISOString()
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'earth-guardians-data.json'
  a.click()
  URL.revokeObjectURL(url)
}

async function onSignOut() {
  const ok = await uiStore.confirm('Sign out of Earth Guardians?')
  if (!ok) return
  await authStore.signOut()
  router.push('/').catch(() => {})
}

onMounted(() => {
  if (authStore.userId) loadNotificationPreferences()
})
</script>

<style scoped>
.settings-view { padding: var(--spacing-xl) 0; }
.page-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
.mt-xl { margin-top: var(--spacing-xl); }
.mt-md { margin-top: var(--spacing-md); }
.mr-md { margin-right: var(--spacing-md); }
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
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--bg-secondary);
}
.setting-item:last-of-type { border-bottom: none; }
</style>
