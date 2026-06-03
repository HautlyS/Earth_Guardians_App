/**
 * UI Store
 * Earth Guardians Platform
 */
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'high-contrast'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

export const useUIStore = defineStore('ui', () => {
  // State
  const theme = ref<Theme>('light')
  const sidebarOpen = ref(false)
  const mobileMenuOpen = ref(false)
  const authModalOpen = ref(false)
  const searchModalOpen = ref(false)
  const loading = ref(false)
  const toasts = ref<Toast[]>([])
  const breadcrumbs = ref<{ label: string; path?: string }[]>([])

  // Initialize theme from localStorage
  const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme && ['light', 'dark', 'high-contrast'].includes(savedTheme)) {
      theme.value = savedTheme
    }
    applyTheme()
  }

  const applyTheme = () => {
    document.documentElement.setAttribute('data-theme', theme.value)
    localStorage.setItem('theme', theme.value)
  }

  // Watch theme changes
  watch(theme, () => {
    applyTheme()
  })

  // Actions
  function setTheme(newTheme: Theme) {
    theme.value = newTheme
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function toggleMobileMenu() {
    mobileMenuOpen.value = !mobileMenuOpen.value
  }

  function openAuthModal() {
    authModalOpen.value = true
  }

  function closeAuthModal() {
    authModalOpen.value = false
  }

  function toggleSearchModal() {
    searchModalOpen.value = !searchModalOpen.value
  }

  function openSearchModal() {
    searchModalOpen.value = true
  }

  function closeSearchModal() {
    searchModalOpen.value = false
  }

  function setLoading(isLoading: boolean) {
    loading.value = isLoading
  }

  function showToast(type: Toast['type'], message: string, duration = 3000) {
    const id = Date.now().toString()
    const toast: Toast = { id, type, message, duration }
    toasts.value.push(toast)

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  function showSuccess(message: string) {
    return showToast('success', message)
  }

  function showError(message: string) {
    return showToast('error', message, 5000)
  }

  function showWarning(message: string) {
    return showToast('warning', message)
  }

  function showInfo(message: string) {
    return showToast('info', message)
  }

  function removeToast(id: string) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function setBreadcrumbs(items: { label: string; path?: string }[]) {
    breadcrumbs.value = items
  }

  function clearBreadcrumbs() {
    breadcrumbs.value = []
  }

  return {
    // State
    theme,
    sidebarOpen,
    mobileMenuOpen,
    authModalOpen,
    searchModalOpen,
    loading,
    toasts,
    breadcrumbs,

    // Actions
    initTheme,
    setTheme,
    toggleSidebar,
    toggleMobileMenu,
    openAuthModal,
    closeAuthModal,
    toggleSearchModal,
    openSearchModal,
    closeSearchModal,
    setLoading,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeToast,
    setBreadcrumbs,
    clearBreadcrumbs
  }
})