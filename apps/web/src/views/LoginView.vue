<template>
  <div class="login-view container">
    <div class="auth-card card">
      <div class="card-header"><h2>SIGN IN</h2></div>
      <div class="card-body">
        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label class="label">Email</label>
            <input v-model="email" type="email" class="input" placeholder="you@example.com" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
            {{ loading ? 'Sending...' : 'Send Magic Link' }}
          </button>
        </form>
        <p class="mt-md text-center">
          <router-link to="/auth/register">Create account</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUIStore()

const email = ref('')
const loading = ref(false)

async function handleLogin() {
  loading.value = true
  const result = await authStore.signInWithEmail(email.value)
  if (result.success) {
    uiStore.showSuccess('Check your email for the magic link!')
  } else {
    uiStore.showError(result.error || 'Login failed')
  }
  loading.value = false
}
</script>

<style scoped>
.login-view { min-height: 60vh; display: flex; align-items: center; justify-content: center; }
.auth-card { max-width: 400px; width: 100%; }
.form-group { margin-bottom: var(--spacing-lg); }
.label { display: block; margin-bottom: var(--spacing-xs); font-weight: bold; text-transform: uppercase; font-size: var(--text-sm); }
.input { width: 100%; padding: var(--spacing-md); border: 2px solid var(--border-color); background: var(--bg-secondary); }
.btn-block { width: 100%; }
.mt-md { margin-top: var(--spacing-md); }
.text-center { text-align: center; }
</style>