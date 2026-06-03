import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { useAuthStore } from './stores/auth'
import { useUIStore } from './stores/ui'
import './assets/css/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Initialize stores
const authStore = useAuthStore()
const uiStore = useUIStore()

// Initialize theme
uiStore.initTheme()

// Initialize auth
authStore.initialize()

app.mount('#app')
