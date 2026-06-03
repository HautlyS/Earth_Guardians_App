<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="auth-modal">
      <div class="modal-header">
        <h2>{{ isLogin ? 'Sign In' : 'Create Account' }}</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <div v-if="error" class="error-message">{{ error }}</div>
        <div v-if="successMessage" class="success-message">{{ successMessage }}</div>

        <div class="form-group">
          <label for="email" class="label">Email</label>
          <input 
            id="email"
            v-model="email" 
            type="email" 
            class="input" 
            placeholder="you@example.com"
            required
          />
        </div>

        <div class="form-group" v-if="!isLogin">
          <label for="password" class="label">Password</label>
          <input 
            id="password"
            v-model="password" 
            type="password" 
            class="input" 
            placeholder="••••••••"
            minlength="8"
            required
          />
        </div>

        <div class="form-group" v-if="!isLogin">
          <label for="confirmPassword" class="label">Confirm Password</label>
          <input 
            id="confirmPassword"
            v-model="confirmPassword" 
            type="password" 
            class="input" 
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
          {{ loading ? 'Please wait...' : (isLogin ? 'Send Magic Link' : 'Create Account') }}
        </button>
      </form>

      <div class="auth-footer">
        <p v-if="isLogin">
          Don't have an account? 
          <button class="switch-btn" @click="isLogin = false">Sign up</button>
        </p>
        <p v-else>
          Already have an account? 
          <button class="switch-btn" @click="isLogin = true">Sign in</button>
        </p>
      </div>

      <div class="demo-hint">
        <p><strong>Demo Mode:</strong> Enter any email to test the auth flow.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useUIStore } from '../stores/ui'

const emit = defineEmits(['close'])

const authStore = useAuthStore()
const uiStore = useUIStore()

const isLogin = ref(true)
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const successMessage = ref('')

async function handleSubmit() {
  error.value = ''
  successMessage.value = ''

  if (!isLogin.value && password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true

  try {
    if (isLogin.value) {
      const result = await authStore.signInWithEmail(email.value)
      if (result.success) {
        successMessage.value = 'Check your email for the magic link!'
      } else {
        error.value = result.error || 'Failed to send magic link'
      }
    } else {
      const result = await authStore.signUp(email.value, password.value)
      if (result.success) {
        successMessage.value = 'Account created! Check your email to verify.'
      } else {
        error.value = result.error || 'Failed to create account'
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'An error occurred'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal, 200);
}

.auth-modal {
  width: 100%;
  max-width: 400px;
  background: var(--bg-primary);
  border: 3px solid var(--border-color);
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: 2px solid var(--border-color);
}

.modal-header h2 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
}

.auth-form {
  padding: var(--spacing-lg);
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

.label {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-weight: bold;
  text-transform: uppercase;
  font-size: var(--text-sm);
}

.input {
  width: 100%;
  padding: var(--spacing-md);
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
  font-size: var(--text-base);
}

.input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.btn-block {
  width: 100%;
}

.error-message {
  background: var(--error-color);
  color: white;
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.success-message {
  background: var(--success-color);
  color: white;
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.auth-footer {
  padding: var(--spacing-lg);
  text-align: center;
  border-top: 1px solid var(--border-color);
}

.switch-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  font-weight: bold;
}

.demo-hint {
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-align: center;
}
</style>