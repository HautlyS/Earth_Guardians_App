<template>
  <div id="earth-guardians-app" :data-theme="theme">
    <AppHeader />
    
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <AppFooter />
    
    <!-- Toast Notifications -->
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div 
          v-for="toast in toasts" 
          :key="toast.id" 
          :class="['toast', `toast-${toast.type}`]"
        >
          <span class="toast-icon">{{ getToastIcon(toast.type) }}</span>
          <span class="toast-message">{{ toast.message }}</span>
          <button class="toast-close" @click="removeToast(toast.id)">×</button>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from './stores/auth'
import { useUIStore } from './stores/ui'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'

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
</script>

<style scoped>
.app-main {
  min-height: calc(100vh - 160px);
}

.toast-container {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: var(--z-toast, 400);
  display: flex;
  flex-direction: column;
  gap: 8px;
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
</style>
