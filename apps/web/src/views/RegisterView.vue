<template>
  <div class="register-view container">
    <div class="auth-card card">
      <div class="card-header"><h2>CREATE ACCOUNT</h2></div>
      <div class="card-body">
        <form @submit.prevent="handleRegister">
          <div class="form-group">
            <label class="label">Email</label>
            <input v-model="email" type="email" class="input" placeholder="you@example.com" required />
          </div>
          <div class="form-group">
            <label class="label">Password</label>
            <input v-model="password" type="password" class="input" placeholder="••••••••" minlength="8" required />
          </div>
          <div class="form-group">
            <label class="label">Confirm Password</label>
            <input v-model="confirmPassword" type="password" class="input" placeholder="••••••••" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
            {{ loading ? 'Creating...' : 'Create Account' }}
          </button>
        </form>
        <p class="mt-md text-center">
          <router-link to="/auth/login">Already have an account?</router-link>
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
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)

async function handleRegister() {
  if (password.value !== confirmPassword.value) {
    uiStore.showError('Passwords do not match')
    return
  }
  
  loading.value = true
  const result = await authStore.signUp(email.value, password.value)
  if (result.success) {
    uiStore.showSuccess('Account created! Check your email to verify.')
    setTimeout(() => router.push('/'), 2000)
  } else {
    uiStore.showError(result.error || 'Registration failed')
  }
  loading.value = false
}
</script>

<style scoped>
.register-view { min-height: 60vh; display: flex; align-items: center; justify-content: center; }
.auth-card { max-width: 400px; width: 100%; }
.form-group { margin-bottom: var(--spacing-lg); }
.label { display: block; margin-bottom: var(--spacing-xs); font-weight: bold; text-transform: uppercase; font-size: var(--text-sm); }
.input { width: 100%; padding: var(--spacing-md); border: 2px solid var(--border-color); background: var(--bg-secondary); }
.btn-block { width: 100%; }
.mt-md { margin-top: var(--spacing-md); }
.text-center { text-align: center; }
</style>