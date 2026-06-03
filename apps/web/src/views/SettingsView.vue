<template>
  <div class="settings-view container">
    <h1 class="text-2xl font-display">SETTINGS</h1>

    <div class="card mt-xl">
      <div class="card-header"><h3>Profile</h3></div>
      <div class="card-body">
        <div class="form-group">
          <label class="label">Display Name</label>
          <input v-model="displayName" type="text" class="input" />
        </div>
        <div class="form-group">
          <label class="label">Bio</label>
          <textarea v-model="bio" class="input textarea" rows="3"></textarea>
        </div>
        <button @click="saveProfile" class="btn btn-primary">Save Changes</button>
      </div>
    </div>

    <div class="card mt-xl">
      <div class="card-header"><h3>Notifications</h3></div>
      <div class="card-body">
        <div class="setting-item">
          <span>Email Notifications</span>
          <input type="checkbox" v-model="emailNotifications" />
        </div>
        <div class="setting-item">
          <span>Push Notifications</span>
          <input type="checkbox" v-model="pushNotifications" />
        </div>
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
        <button @click="exportAllData" class="btn btn-secondary mr-md">Export All Data</button>
        <button @click="clearAllData" class="btn btn-danger">Clear All Data</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'
import ThemeSwitcher from '../components/ThemeSwitcher.vue'

const authStore = useAuthStore()
const uiStore = useUIStore()

const displayName = ref(authStore.profile?.display_name || '')
const bio = ref(authStore.profile?.bio || '')
const emailNotifications = ref(true)
const pushNotifications = ref(true)

async function saveProfile() {
  const result = await authStore.updateProfile({
    display_name: displayName.value,
    bio: bio.value
  })
  if (!result.error) {
    uiStore.showSuccess('Profile updated!')
  } else {
    uiStore.showError('Failed to update profile')
  }
}

function exportAllData() {
  const data = { profile: authStore.profile, timestamp: Date.now() }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'earth-guardians-data.json'
  a.click()
  URL.revokeObjectURL(url)
}

function clearAllData() {
  if (confirm('This will delete all local data. Continue?')) {
    localStorage.clear()
    sessionStorage.clear()
    window.location.reload()
  }
}
</script>

<style scoped>
.settings-view { padding: var(--spacing-xl) 0; }
.mt-xl { margin-top: var(--spacing-xl); }
.mr-md { margin-right: var(--spacing-md); }
.form-group { margin-bottom: var(--spacing-lg); }
.label { display: block; margin-bottom: var(--spacing-xs); font-weight: bold; text-transform: uppercase; font-size: var(--text-sm); }
.input { width: 100%; padding: var(--spacing-md); border: 2px solid var(--border-color); background: var(--bg-secondary); }
.textarea { resize: vertical; }
.setting-item { display: flex; justify-content: space-between; padding: var(--spacing-md); border-bottom: 1px solid var(--bg-secondary); }
</style>