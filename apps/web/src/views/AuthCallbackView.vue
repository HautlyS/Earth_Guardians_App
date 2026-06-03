<template>
  <div class="auth-callback-view container">
    <div class="loading-state">
      <div class="spinner"></div>
      <p>{{ statusMessage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const statusMessage = ref('Processing authentication...')

onMounted(async () => {
  const token = route.query.token as string
  const email = route.query.email as string
  const error = route.query.error as string

  if (error) {
    statusMessage.value = `Authentication failed: ${error}`
    setTimeout(() => router.push('/'), 3000)
    return
  }

  if (token) {
    try {
      statusMessage.value = 'Verifying your account...'
      // In a real app, you'd verify the token here via an edge function
      // For now, we'll just redirect to home
      await authStore.initialize()
      statusMessage.value = 'Authentication successful!'
      setTimeout(() => router.push('/'), 1000)
    } catch (e) {
      statusMessage.value = 'Authentication failed'
      setTimeout(() => router.push('/'), 3000)
    }
  } else {
    statusMessage.value = 'No authentication token found'
    setTimeout(() => router.push('/'), 3000)
  }
})
</script>

<style scoped>
.auth-callback-view {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.loading-state {
  text-align: center;
}
.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid var(--bg-secondary);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto var(--spacing-lg);
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>