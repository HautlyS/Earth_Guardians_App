<template>
  <div class="auth-callback-view container">
    <div class="loading-state">
      <div class="spinner" aria-hidden="true"></div>
      <p>{{ statusMessage }}</p>
      <p v-if="status === 'error'" class="error-text">{{ errorDetail }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const status = ref<'pending' | 'ok' | 'error'>('pending')
const statusMessage = ref('Completing sign-in…')
const errorDetail = ref('')

function resolveRedirect(): string {
  const r = route.query.redirect
  if (typeof r === 'string' && r.startsWith('/')) return r
  return '/'
}

onMounted(async () => {
  const redirectTo = resolveRedirect()
  const errorParam = route.query.error_description ?? route.query.error
  const code = route.query.code
  const tokenHash = route.query.token_hash
  const type = route.query.type as string | undefined

  try {
    if (errorParam) {
      status.value = 'error'
      statusMessage.value = 'Sign-in failed.'
      errorDetail.value = String(errorParam)
      setTimeout(() => router.replace(redirectTo), 2500)
      return
    }

    // PKCE / OAuth callback
    if (typeof code === 'string' && code.length > 0) {
      statusMessage.value = 'Exchanging authorization code…'
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code)
      if (exErr) throw exErr
    } else if (typeof tokenHash === 'string' && tokenHash.length > 0) {
      // Magic-link / OTP callback (Supabase verifyOtp path)
      statusMessage.value = 'Verifying one-time link…'
      const { error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: (type as 'magiclink' | 'email' | 'signup' | 'recovery' | 'invite') || 'magiclink'
      })
      if (otpErr) throw otpErr
    } else {
      // No params — let detectSessionInUrl (already enabled) and the auth listener pick it up.
      // Just ensure the store is initialized.
      await authStore.initialize()
    }

    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      throw new Error('No active session after callback')
    }
    await authStore.fetchProfile()
    status.value = 'ok'
    statusMessage.value = 'Signed in. Redirecting…'
    setTimeout(() => router.replace(redirectTo), 500)
  } catch (e) {
    console.error('Auth callback error:', e)
    status.value = 'error'
    statusMessage.value = 'Sign-in failed.'
    errorDetail.value = e instanceof Error ? e.message : String(e)
    setTimeout(() => router.replace(redirectTo), 3000)
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
  max-width: 480px;
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
.error-text {
  color: var(--error-color);
  font-size: var(--text-sm);
  margin-top: var(--spacing-sm);
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
