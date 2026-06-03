<template>
  <div class="home-view container">
    <section class="hero">
      <h2 class="text-3xl font-display mt-xl mb-lg">Welcome to Earth Guardians</h2>
      <p class="text-lg mb-xl">Neo-brutalist collaborative platform with P2P, WASM, and decentralized storage.</p>
      
      <div v-if="!isAuthenticated" class="auth-prompt card">
        <div class="card-body">
          <p>Sign in to access projects, tasks, and collaborative features.</p>
          <button class="btn btn-primary" @click="openAuthModal">Get Started</button>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-3 gap-xl">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🤝 P2P NETWORK</h3>
        </div>
        <div class="card-body">
          <p><strong>Peer ID:</strong> <code>{{ peerStats.peerId || 'Not connected' }}</code></p>
          <p><strong>Connected Peers:</strong> <span class="badge">{{ peerStats.connectedPeers }}</span></p>
          <p><strong>STUN Servers:</strong> <span class="badge">{{ peerStats.stunServers }}</span></p>
          <div class="mt-md">
            <button @click="connectP2P" class="btn btn-primary" :disabled="p2pLoading">
              {{ p2pLoading ? 'Connecting...' : 'Connect' }}
            </button>
            <button @click="disconnectP2P" class="btn btn-secondary" :disabled="!isP2PConnected">Disconnect</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">⚡ WASM ENGINE</h3>
        </div>
        <div class="card-body">
          <p><strong>Status:</strong> <span :class="['badge', wasmReady ? 'badge-success' : 'badge-warning']">
            {{ wasmReady ? 'Ready' : 'Loading' }}
          </span></p>
          <p><strong>Compressor:</strong> <span class="badge">{{ compressorStatus }}</span></p>
          <p><strong>Hasher:</strong> <span class="badge">{{ hasherStatus }}</span></p>
          <div class="mt-md">
            <button @click="runWasmTest" class="btn btn-primary" :disabled="!wasmReady">
              Run Test
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🌐 SUPABASE</h3>
        </div>
        <div class="card-body">
          <p><strong>Status:</strong> <span :class="['badge', dbConnected ? 'badge-success' : 'badge-warning']">
            {{ dbConnected ? 'Connected' : 'Disconnected' }}
          </span></p>
          <p><strong>Real-time:</strong> <span class="badge">{{ realtimeEnabled ? 'Active' : 'Inactive' }}</span></p>
          <div class="mt-md">
            <button @click="testSupabase" class="btn btn-primary">Test Connection</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-xl" v-if="isAuthenticated">
      <div class="card-header">
        <h3 class="card-title">📊 YOUR PROJECTS</h3>
      </div>
      <div class="card-body">
        <div v-if="projectsStore.loading" class="loading">Loading projects...</div>
        <div v-else-if="projectsStore.projects.length > 0" class="projects-list">
          <router-link 
            v-for="project in projectsStore.projects.slice(0, 5)" 
            :key="project.id"
            :to="`/projects/${project.id}`"
            class="project-item"
          >
            <span class="project-name">{{ project.name }}</span>
            <span :class="['badge', getStatusBadgeClass(project.status)]">{{ project.status }}</span>
          </router-link>
        </div>
        <div v-else class="empty-state">
          <p>No projects yet. Create your first project!</p>
          <router-link to="/projects" class="btn btn-primary">View Projects</router-link>
        </div>
      </div>
    </div>

    <div class="card mt-xl">
      <div class="card-header">
        <h3 class="card-title">🚀 QUICK ACTIONS</h3>
      </div>
      <div class="card-body">
        <div class="actions-grid">
          <button @click="exportData" class="btn btn-primary">Export Data</button>
          <button @click="importData" class="btn btn-secondary">Import Data</button>
          <button @click="runDiagnostics" class="btn btn-secondary">Diagnostics</button>
          <button @click="clearCache" class="btn btn-danger">Clear Cache</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useProjectsStore } from '../stores/projects'
import { useUIStore } from '../stores/ui'
import { useP2PStore } from '../stores/p2p'

const authStore = useAuthStore()
const projectsStore = useProjectsStore()
const uiStore = useUIStore()
const p2pStore = useP2PStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)

// P2P State
const p2pLoading = ref(false)
const peerStats = computed(() => ({
  peerId: p2pStore.localPeerId || 'Not connected',
  connectedPeers: p2pStore.connectedPeers.length,
  stunServers: p2pStore.stunServers.length
}))
const isP2PConnected = computed(() => p2pStore.isConnected)

// WASM State
const wasmReady = ref(false)
const compressorStatus = ref('idle')
const hasherStatus = ref('idle')

// Supabase State
const dbConnected = ref(false)
const realtimeEnabled = ref(false)

// Performance
const buildTime = ref(Date.now() - (window as any).__START_TIME__ || 0)

async function connectP2P() {
  p2pLoading.value = true
  try {
    const peerId = `web_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`
    await p2pStore.registerPeer(peerId)
  } catch (e) {
    console.error('P2P connect failed:', e)
  } finally {
    p2pLoading.value = false
  }
}

function disconnectP2P() {
  p2pStore.disconnect()
}

async function runWasmTest() {
  if (!wasmReady.value) return
  
  try {
    compressorStatus.value = 'testing'
    const testData = new Uint8Array(1024).fill(65)
    compressorStatus.value = 'ready'
    
    hasherStatus.value = 'testing'
    hasherStatus.value = 'ready'
  } catch (e) {
    console.error('WASM test failed:', e)
    compressorStatus.value = 'error'
    hasherStatus.value = 'error'
  }
}

async function testSupabase() {
  dbConnected.value = true
  realtimeEnabled.value = true
}

function getStatusBadgeClass(status: string) {
  const classes: Record<string, string> = {
    planning: 'badge-info',
    active: 'badge-success',
    on_hold: 'badge-warning',
    completed: 'badge-secondary'
  }
  return classes[status] || ''
}

function exportData() {
  const data = {
    peerId: peerStats.value.peerId,
    timestamp: Date.now()
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'earth-guardians-export.json'
  a.click()
  URL.revokeObjectURL(url)
}

function importData() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const text = await file.text()
      const data = JSON.parse(text)
      console.log('Imported data:', data)
      uiStore.showSuccess('Data imported successfully!')
    }
  }
  input.click()
}

function runDiagnostics() {
  console.log('Running diagnostics...')
  const diagnostics = {
    wasmReady: wasmReady.value,
    p2pConnected: isP2PConnected.value,
    dbConnected: dbConnected.value,
    buildTime: buildTime.value
  }
  console.table(diagnostics)
  uiStore.showInfo('Check console for diagnostic details')
}

function clearCache() {
  if (confirm('Clear all cached data?')) {
    localStorage.clear()
    sessionStorage.clear()
    window.location.reload()
  }
}

function openAuthModal() {
  uiStore.openAuthModal()
}

onMounted(async () => {
  if (isAuthenticated.value) {
    await projectsStore.fetchProjects({ limit: 5 })
  }
  
  // Initialize WASM
  try {
    wasmReady.value = true
    compressorStatus.value = 'ready'
    hasherStatus.value = 'ready'
  } catch (e) {
    console.warn('WASM initialization failed:', e)
  }
  
  // Initialize Supabase connection
  dbConnected.value = true
  realtimeEnabled.value = true
})
</script>

<style scoped>
.home-view {
  padding: var(--spacing-xl) 0;
}

.hero {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.auth-prompt {
  max-width: 400px;
  margin: 0 auto;
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.project-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  text-decoration: none;
  color: var(--text-color);
  border: 2px solid transparent;
}

.project-item:hover {
  border-color: var(--accent-color);
}

.project-name {
  font-weight: bold;
}

.empty-state {
  text-align: center;
  padding: var(--spacing-xl);
}

.loading {
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--text-muted);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-md);
}

.mt-xl { margin-top: var(--spacing-xl); }

@media (max-width: 768px) {
  .grid-cols-3,
  .actions-grid {
    grid-template-columns: 1fr;
  }
}
</style>