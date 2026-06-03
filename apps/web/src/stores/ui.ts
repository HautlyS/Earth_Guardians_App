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
  timer?: ReturnType<typeof setTimeout>
}

const THEME_KEY = 'eg:theme'
const VALID_THEMES: Theme[] = ['light', 'dark', 'high-contrast']

export const useUIStore = defineStore('ui', () => {
  const theme = ref<Theme>('light')
  const sidebarOpen = ref(false)
  const mobileMenuOpen = ref(false)
  const authModalOpen = ref(false)
  const searchModalOpen = ref(false)
  const loading = ref(false)
  const toasts = ref<Toast[]>([])
  const breadcrumbs = ref<{ label: string; path?: string }[]>([])

  function initTheme(): void {
    if (typeof localStorage === 'undefined') return
    const saved = localStorage.getItem(THEME_KEY) as Theme | null
    if (saved && VALID_THEMES.includes(saved)) theme.value = saved
    applyTheme()
  }

  function applyTheme(): void {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', theme.value)
    try {
      localStorage.setItem(THEME_KEY, theme.value)
    } catch {
      // ignore quota errors
    }
  }

  watch(theme, () => applyTheme())

  function setTheme(newTheme: Theme): void {
    if (VALID_THEMES.includes(newTheme)) theme.value = newTheme
  }

  function toggleSidebar(): void {
    sidebarOpen.value = !sidebarOpen.value
  }
  function toggleMobileMenu(): void {
    mobileMenuOpen.value = !mobileMenuOpen.value
  }
  function openAuthModal(): void {
    authModalOpen.value = true
  }
  function closeAuthModal(): void {
    authModalOpen.value = false
  }
  function toggleSearchModal(): void {
    searchModalOpen.value = !searchModalOpen.value
  }
  function openSearchModal(): void {
    searchModalOpen.value = true
  }
  function closeSearchModal(): void {
    searchModalOpen.value = false
  }
  function setLoading(isLoading: boolean): void {
    loading.value = isLoading
  }

  function genId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  function showToast(type: Toast['type'], message: string, duration = 3000): string {
    const id = genId()
    const toast: Toast = { id, type, message, duration }
    toasts.value.push(toast)
    if (duration > 0) {
      toast.timer = setTimeout(() => removeToast(id), duration)
    }
    return id
  }

  function showSuccess(message: string): string {
    return showToast('success', message)
  }
  function showError(message: string): string {
    return showToast('error', message, 5000)
  }
  function showWarning(message: string): string {
    return showToast('warning', message)
  }
  function showInfo(message: string): string {
    return showToast('info', message)
  }

  function removeToast(id: string): void {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx === -1) return
    const t = toasts.value[idx]
    if (t.timer) clearTimeout(t.timer)
    toasts.value.splice(idx, 1)
  }

  function confirm(message: string, title = 'Confirm'): Promise<boolean> {
    return new Promise((resolve) => {
      // Native confirm is blocking; for now use it but centralize.
      // A proper modal-based confirm would be a future enhancement.
      void title
      resolve(typeof window !== 'undefined' && window.confirm(message))
    })
  }

  function setBreadcrumbs(items: { label: string; path?: string }[]): void {
    breadcrumbs.value = items
  }
  function clearBreadcrumbs(): void {
    breadcrumbs.value = []
  }

  const isDark = computed(() => theme.value === 'dark' || theme.value === 'high-contrast')

  return {
    theme,
    sidebarOpen,
    mobileMenuOpen,
    authModalOpen,
    searchModalOpen,
    loading,
    toasts,
    breadcrumbs,
    isDark,
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
    confirm,
    setBreadcrumbs,
    clearBreadcrumbs,
  }
})
