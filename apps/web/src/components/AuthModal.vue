<template>
  <div class="modal-overlay" @click.self="close">
    <div class="auth-modal" role="dialog" aria-modal="true" :aria-labelledby="'auth-modal-title'">
      <div class="modal-header">
        <h2 id="auth-modal-title">{{ isLogin ? 'Sign In' : 'Create Account' }}</h2>
        <button class="close-btn" @click="close" aria-label="Close auth dialog">×</button>
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form" novalidate>
        <div v-if="error" class="error-message" role="alert">{{ error }}</div>
        <div v-if="successMessage" class="success-message" role="status">{{ successMessage }}</div>

        <div class="form-group">
          <label for="auth-email" class="label">Email</label>
          <input
            id="auth-email"
            v-model.trim="email"
            type="email"
            class="input"
            placeholder="you@example.com"
            autocomplete="email"
            required
          />
        </div>

        <template v-if="!isLogin">
          <div class="form-group">
            <label for="auth-password" class="label">Password</label>
            <input
              id="auth-password"
              v-model="password"
              type="password"
              class="input"
              placeholder="At least 8 characters"
              autocomplete="new-password"
              minlength="8"
              required
            />
            <small v-if="password && !isStrongPassword" class="hint">
              Use 8+ chars with a mix of letters, numbers, and symbols.
            </small>
          </div>

          <div class="form-group">
            <label for="auth-confirm" class="label">Confirm Password</label>
            <input
              id="auth-confirm"
              v-model="confirmPassword"
              type="password"
              class="input"
              placeholder="Repeat your password"
              autocomplete="new-password"
              minlength="8"
              required
            />
          </div>
        </template>

        <button
          type="submit"
          class="btn btn-primary btn-block"
          :disabled="loading || !canSubmit"
        >
          {{ loading ? 'Please wait...' : (isLogin ? 'Send Sign-In Link' : 'Create Account') }}
        </button>
      </form>

      <div class="auth-footer">
        <p v-if="isLogin">
          Don't have an account?
          <button class="switch-btn" @click="switchMode(false)">Sign up</button>
        </p>
        <p v-else>
          Already have an account?
          <button class="switch-btn" @click="switchMode(true)">Sign in</button>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAuthStore } from '../stores/auth'

const emit = defineEmits<{ (e: 'close'): void }>()

const authStore = useAuthStore()

const isLogin = ref(true)
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const successMessage = ref('')

const isStrongPassword = computed(() => {
  if (password.value.length < 8) return false
  const hasLetter = /[A-Za-z]/.test(password.value)
  const hasNumber = /[0-9]/.test(password.value)
  return hasLetter && hasNumber
})

const canSubmit = computed(() => {
  if (!email.value) return false
  if (isLogin.value) return true
  if (password.value.length < 8) return false
  return password.value === confirmPassword.value
})

function close() {
  emit('close')
}

function switchMode(toLogin: boolean) {
  isLogin.value = toLogin
  error.value = ''
  successMessage.value = ''
  if (toLogin) {
    password.value = ''
    confirmPassword.value = ''
  }
}

async function handleSubmit() {
  error.value = ''
  successMessage.value = ''

  if (!isLogin.value) {
    if (password.value !== confirmPassword.value) {
      error.value = 'Passwords do not match'
      return
    }
    if (!isStrongPassword.value) {
      error.value = 'Choose a stronger password (8+ chars, letters and numbers).'
      return
    }
  }

  loading.value = true

  try {
    if (isLogin.value) {
      const result = await authStore.signInWithEmail(email.value)
      if (result.success) {
        successMessage.value = 'Check your email for a one-time sign-in link.'
        email.value = ''
      } else {
        error.value = result.error || 'Failed to send sign-in link'
      }
    } else {
      const result = await authStore.signUp(email.value, password.value)
      if (result.success) {
        successMessage.value = 'Account created! Check your email to verify before signing in.'
        password.value = ''
        confirmPassword.value = ''
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

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
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
  max-height: 90vh;
  overflow-y: auto;
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
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  line-height: 1;
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
  color: var(--text-color);
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
  text-decoration: underline;
}

.hint {
  display: block;
  margin-top: var(--spacing-xs);
  font-size: var(--text-xs);
  color: var(--text-muted);
}
</style>
