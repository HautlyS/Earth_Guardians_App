<template>
  <div class="profile-view container">
    <div class="profile-header card">
      <div class="card-body">
        <UserAvatar :src="authStore.avatarUrl" :name="authStore.displayName" size="xl" />
        <h1 class="text-2xl font-display mt-lg">{{ authStore.displayName }}</h1>
        <p class="text-muted">@{{ authStore.profile?.username || 'username' }}</p>
        <p v-if="authStore.profile?.bio" class="bio mt-md">{{ authStore.profile.bio }}</p>
        
        <div class="stats-grid mt-xl">
          <div class="stat">
            <span class="stat-value">{{ stats.projects }}</span>
            <span class="stat-label">Projects</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ stats.tasks }}</span>
            <span class="stat-label">Tasks</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ stats.crews }}</span>
            <span class="stat-label">Crews</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-xl">
      <div class="card-header"><h3>Activity</h3></div>
      <div class="card-body">
        <p class="text-muted">Recent activity will be shown here.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import UserAvatar from '../components/UserAvatar.vue'

const authStore = useAuthStore()

const stats = computed(() => ({
  projects: authStore.profile ? 0 : 0,
  tasks: authStore.profile ? 0 : 0,
  crews: authStore.profile ? 0 : 0
}))
</script>

<style scoped>
.profile-view { padding: var(--spacing-xl) 0; }
.profile-header { text-align: center; }
.mt-xl { margin-top: var(--spacing-xl); }
.mt-lg { margin-top: var(--spacing-lg); }
.bio { max-width: 600px; margin: 0 auto; }
.stats-grid { display: flex; justify-content: center; gap: var(--spacing-3xl); }
.stat { text-align: center; }
.stat-value { display: block; font-size: var(--text-3xl); font-weight: bold; color: var(--accent-color); }
.stat-label { font-size: var(--text-sm); color: var(--text-muted); text-transform: uppercase; }
</style>