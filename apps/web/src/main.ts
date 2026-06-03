import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { useAuthStore } from './stores/auth'
import { useUIStore } from './stores/ui'
import { config } from './utils/config'
import './assets/css/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue] Unhandled error in', info, err)
  const uiStore = useUIStore()
  uiStore.showToast('error', 'Something went wrong. Please try again.')
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Window] Unhandled promise rejection:', event.reason)
  const uiStore = useUIStore()
  uiStore.showToast('error', 'An async operation failed.')
})

const uiStore = useUIStore()
uiStore.initTheme()

const authStore = useAuthStore()
await authStore.initialize()

if (config.features.offline && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('Service worker registration failed:', err))
  })
}

app.mount('#app')
