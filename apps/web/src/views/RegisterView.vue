<template>
  <div class="register-view container">
    <div class="auth-card card">
      <div class="card-header"><h2>Create Account</h2></div>
      <div class="card-body">
        <p class="text-muted">Sign up, then verify your email before signing in.</p>
        <form @submit.prevent="handleRegister">
          <div class="form-group">
            <label for="reg-email" class="label">Email</label>
            <input id="reg-email" v-model.trim="email" type="email" class="input" placeholder="you@example.com" autocomplete="email" required />
          </div>
          <div class="form-group">
            <label for="reg-password" class="label">Password</label>
            <input id="reg-password" v-model="password" type="password" class="input" placeholder="At least 8 characters" autocomplete="new-password" minlength="8" required />
            <small v-if="password && !isStrongPassword" class="hint">Use 8+ chars with letters and numbers.</small>
          </div>
          <div class="form-group">
            <label for="reg-confirm" class="label">Confirm Password</label>
            <input id="reg-confirm" v-model="confirmPassword" type="password" class="input" placeholder="Repeat your password" autocomplete="new-password" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block" :disabled="loading || !canSubmit">
            {{ loading ? 'Creating…' : 'Create Account' }}
          </button>
        </form>
        <p v-if="message" class="message">{{ message }}</p>
        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
        <p class="mt-md text-center">
          <router-link :to="{ path: '/auth/login', query: route.query }">Already have an account?</router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUIStore()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const message = ref('')
const error = ref('')

const isStrongPassword = computed(() => {
  if (password.value.length < 8) return false
  return /[A-Za-z]/.test(password.value) && /[0-9]/.test(password.value)
})

const canSubmit = computed(() => {
  if (!email.value) return false
  if (password.value.length < 8) return false
  return password.value === confirmPassword.value
})

async function handleRegister() {
  error.value = ''
  message.value = ''

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }
  if (!isStrongPassword.value) {
    error.value = 'Choose a stronger password (8+ chars, letters and numbers).'
    return
  }

  loading.value = true
  const result = await authStore.signUp(email.value, password.value, {
    redirect_to: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent('/')}`
  })
  loading.value = false
  if (result.success) {
    message.value = 'Account created! Check your email to verify before signing in.'
    uiStore.showSuccess('Account created — check your email')
    setTimeout(() => {
      const redirect = route.query.redirect
      const dest = typeof redirect === 'string' && redirect.startsWith('/') ? '/auth/login' : '/auth/login'
      router.push({ path: dest, query: { email: email.value } })
    }, 2000)
  } else {
    error.value = result.error || 'Registration failed'
    uiStore.showError(error.value)
  }
  void router // keep router import; navigation above is enough
}
</script>

<style scoped>
.register-view { min-height: 60vh; display: flex; align-items: center; justify-content: center; padding: var(--spacing-xl) 0; }
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
.hint { display: block; margin-top: var(--spacing-xs); font-size: var(--text-xs); color: var(--text-muted); }
.message {
  background: var(--success-color);
  color: white;
  padding: var(--spacing-sm) var(--spacing-md);
  margin-top: var(--spacing-md);
  font-size: var(--text-sm);
}
.error-text { color: var(--error-color); font-size: var(--text-sm); margin-top: var(--spacing-sm); }
</style>
