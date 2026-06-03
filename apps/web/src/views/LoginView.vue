<template>
  <div class="login-view container">
    <div class="auth-card card">
      <div class="card-header"><h2>Sign In</h2></div>
      <div class="card-body">
        <p class="text-muted">We'll email you a one-time sign-in link.</p>
        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label for="login-email" class="label">Email</label>
            <input
              id="login-email"
              v-model.trim="email"
              type="email"
              class="input"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary btn-block" :disabled="loading || !email">
            {{ loading ? 'Sending…' : 'Send Sign-In Link' }}
          </button>
        </form>
        <p v-if="message" class="message">{{ message }}</p>
        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
        <p class="mt-md text-center">
          <router-link :to="{ path: '/auth/register', query: route.query }">Create an account</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUIStore()

const email = ref('')
const loading = ref(false)
const message = ref('')
const error = ref('')

function resolveRedirect(): string {
  const r = route.query.redirect
  if (typeof r === 'string' && r.startsWith('/')) return r
  return '/'
}

async function handleLogin() {
  if (!email.value) return
  loading.value = true
  message.value = ''
  error.value = ''
  const result = await authStore.signInWithEmail(email.value, `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(resolveRedirect())}`)
  loading.value = false
  if (result.success) {
    message.value = 'Check your email for the sign-in link. You can close this tab.'
  } else {
    error.value = result.error || 'Sign-in failed'
    uiStore.showError(error.value)
  }
  void router // keep route import used; redirect happens via email link
}
</script>

<style scoped>
.login-view { min-height: 60vh; display: flex; align-items: center; justify-content: center; padding: var(--spacing-xl) 0; }
.auth-card { max-width: 400px; width: 100%; }
.text-muted { color: var(--text-muted); margin-bottom: var(--spacing-md); }
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
.btn-block { width: 100%; }
.mt-md { margin-top: var(--spacing-md); }
.text-center { text-align: center; }
.message {
  background: var(--success-color);
  color: white;
  padding: var(--spacing-sm) var(--spacing-md);
  margin-top: var(--spacing-md);
  font-size: var(--text-sm);
}
.error-text { color: var(--error-color); font-size: var(--text-sm); margin-top: var(--spacing-sm); }
</style>
