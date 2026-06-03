<template>
  <div id="earth-guardians-app" :data-theme="theme" @vue:mounted="onMounted">
    <AppHeader />

    <main class="app-main">
      <router-view v-slot="{ Component, route }">
        <transition name="fade" mode="out-in">
          <Suspense>
            <component :is="Component" :key="route.fullPath" />
            <template #fallback>
              <div class="route-loading" aria-live="polite">Loading…</div>
            </template>
          </Suspense>
        </transition>
      </router-view>
    </main>

    <AppFooter />

    <Teleport to="body">
      <AuthModal v-if="uiStore.authModalOpen" @close="uiStore.closeAuthModal()" />
      <SearchModal v-if="uiStore.searchModalOpen" @close="uiStore.closeSearchModal()" />
    </Teleport>

    <Teleport to="body">
      <div class="toast-container" aria-live="polite" aria-atomic="true">
        <TransitionGroup name="toast">
          <div
            v-for="toast in toasts"
            :key="toast.id"
            :class="['toast', `toast-${toast.type}`]"
            role="status"
          >
            <span class="toast-icon" aria-hidden="true">{{ getToastIcon(toast.type) }}</span>
            <span class="toast-message">{{ toast.message }}</span>
            <button
              class="toast-close"
              :aria-label="`Dismiss ${toast.type} notification`"
              @click="removeToast(toast.id)"
            >
              ×
            </button>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured } from 'vue'
import { useAuthStore } from './stores/auth'
import { useUIStore } from './stores/ui'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import AuthModal from './components/AuthModal.vue'
import SearchModal from './components/SearchModal.vue'

const authStore = useAuthStore()
const uiStore = useUIStore()

const theme = computed(() => uiStore.theme)
const toasts = computed(() => uiStore.toasts)

function getToastIcon(type: string) {
  const icons: Record<string, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  }
  return icons[type] || 'ℹ'
}

function removeToast(id: string) {
  uiStore.removeToast(id)
}

onErrorCaptured((err, _instance, info) => {
  console.error('[ErrorBoundary] Captured:', info, err)
  uiStore.showToast('error', 'A view failed to render. See the console for details.')
  return false
})

function onMounted() {
  if (authStore.isAuthenticated && !authStore.profile) {
    authStore.fetchProfile().catch((e) => console.error('Profile bootstrap failed:', e))
  }
}
</script>

<style scoped>
.app-main {
  min-height: calc(100vh - 160px);
}

.route-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  color: var(--text-secondary, #6b7280);
  font-size: 1rem;
}

.toast-container {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: var(--z-toast, 400);
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-primary);
  border: 2px solid var(--border-color);
  box-shadow: var(--shadow-md);
  min-width: 280px;
  max-width: 400px;
  pointer-events: auto;
}

.toast-success {
  border-color: var(--success-color);
}

.toast-error {
  border-color: var(--error-color);
}

.toast-warning {
  border-color: var(--warning-color);
}

.toast-info {
  border-color: var(--info-color);
}

.toast-icon {
  font-size: 1.2rem;
}

.toast-message {
  flex: 1;
}

.toast-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  color: inherit;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@media (max-width: 480px) {
  .toast-container {
    top: 70px;
    right: 12px;
    left: 12px;
  }
  .toast {
    min-width: 0;
    max-width: none;
  }
}
</style>
