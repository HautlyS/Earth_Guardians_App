<template>
  <div class="home-view container">
    <section class="hero">
      <h1 class="hero-title">Welcome to Earth Guardians</h1>
      <p class="hero-sub">A neo-brutalist platform for organising crews, projects, and P2P collaboration.</p>

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
          <p><strong>Peer ID:</strong> <code class="peer-id">{{ shortPeerId || 'Not connected' }}</code></p>
          <p><strong>Connected Peers:</strong> <span class="badge">{{ p2pStore.connectedPeers.length }}</span></p>
          <p><strong>STUN Servers:</strong> <span class="badge">{{ p2pStore.stunServers.length }}</span></p>
          <div class="mt-md">
            <button
              v-if="!isAuthenticated"
              class="btn btn-primary"
              disabled
              :aria-disabled="true"
            >
              Sign in to connect
            </button>
            <template v-else>
              <button @click="connectP2P" class="btn btn-primary" :disabled="p2pStore.loading">
                {{ p2pStore.loading ? 'Connecting…' : (p2pStore.isConnected ? 'Reconnect' : 'Connect') }}
              </button>
              <button @click="p2pStore.disconnect()" class="btn btn-secondary" :disabled="!p2pStore.isConnected">
                Disconnect
              </button>
            </template>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">⚡ WASM ENGINE</h3>
        </div>
        <div class="card-body">
          <p>
            <strong>Status:</strong>
            <span :class="['badge', wasmReady ? 'badge-success' : 'badge-warning']">
              {{ wasmReady ? 'Ready' : 'Loading' }}
            </span>
          </p>
          <p><strong>Compressor:</strong> <span class="badge">{{ compressorStatus }}</span></p>
          <p><strong>Hasher:</strong> <span class="badge">{{ hasherStatus }}</span></p>
          <div class="mt-md">
            <button @click="runWasmTest" class="btn btn-primary" :disabled="!wasmReady">
              Run Round-Trip Test
            </button>
          </div>
          <p v-if="wasmError" class="text-error text-sm mt-sm">{{ wasmError }}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🌐 SUPABASE</h3>
        </div>
        <div class="card-body">
          <p>
            <strong>Status:</strong>
            <span :class="['badge', dbConnected ? 'badge-success' : 'badge-warning']">
              {{ dbConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </p>
          <p>
            <strong>Realtime:</strong>
            <span class="badge">{{ realtimeEnabled ? 'Subscribed' : 'Inactive' }}</span>
          </p>
          <div class="mt-md">
            <button @click="probeSupabase" class="btn btn-primary" :disabled="probing">
              {{ probing ? 'Probing…' : 'Probe' }}
            </button>
          </div>
          <p v-if="supabaseError" class="text-error text-sm mt-sm">{{ supabaseError }}</p>
        </div>
      </div>
    </div>

    <div class="card mt-xl" v-if="isAuthenticated">
      <div class="card-header">
        <h3 class="card-title">📊 YOUR PROJECTS</h3>
      </div>
      <div class="card-body">
        <div v-if="projectsStore.loading" class="loading">Loading projects…</div>
        <div v-else-if="recentProjects.length > 0" class="projects-list">
          <router-link
            v-for="project in recentProjects"
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
          <router-link to="/projects" class="btn btn-primary">Go to Projects</router-link>
        </div>
      </div>
    </div>

    <div class="card mt-xl">
      <div class="card-header">
        <h3 class="card-title">🚀 QUICK ACTIONS</h3>
      </div>
      <div class="card-body">
        <div class="actions-grid">
          <button @click="exportData" class="btn btn-primary">Export Peer State</button>
          <button @click="runDiagnostics" class="btn btn-secondary">Diagnostics</button>
          <button @click="clearCache" class="btn btn-danger">Clear Local Cache</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useProjectsStore } from '../stores/projects'
import { useUIStore } from '../stores/ui'
import { useP2PStore } from '../stores/p2p'
import { useNotificationsStore } from '../stores/notifications'
import { supabase, isConfigured } from '../lib/supabase'
import { initializeWasm, isWasmAvailable, compress, decompress, hash } from '../utils/wasm'

const route = useRoute()
const authStore = useAuthStore()
const projectsStore = useProjectsStore()
const uiStore = useUIStore()
const p2pStore = useP2PStore()
const notificationsStore = useNotificationsStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)
const recentProjects = computed(() => projectsStore.projects.slice(0, 5))
const shortPeerId = computed(() => {
  const id = p2pStore.localPeerId
  if (!id) return ''
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id
})

const wasmReady = ref(false)
const wasmError = ref('')
const compressorStatus = ref('idle')
const hasherStatus = ref('idle')

const dbConnected = ref(false)
const realtimeEnabled = ref(false)
const probing = ref(false)
const supabaseError = ref('')

async function connectP2P() {
  if (!authStore.isAuthenticated) {
    uiStore.openAuthModal()
    return
  }
  try {
    const result = await p2pStore.registerPeer()
    if (result.success) {
      p2pStore.subscribeToSignals()
      uiStore.showSuccess('P2P network ready')
    } else {
      uiStore.showError(result.error || 'Failed to connect')
    }
  } catch (e) {
    console.error('P2P connect failed:', e)
    uiStore.showError('P2P connect failed')
  }
}

async function runWasmTest() {
  if (!wasmReady.value) return
  compressorStatus.value = 'testing'
  hasherStatus.value = 'testing'
  try {
    const sample = new TextEncoder().encode('Earth Guardians round-trip test — 漢字 OK')
    const compressed = await compress(sample)
    const decompressed = await decompress(compressed)
    const text = new TextDecoder().decode(decompressed)
    if (text !== new TextDecoder().decode(sample)) {
      throw new Error('Round-trip mismatch')
    }
    const h = await hash(sample)
    if (!h || h.length < 8) throw new Error('Hash empty')
    compressorStatus.value = 'ready'
    hasherStatus.value = 'ready'
    uiStore.showSuccess('WASM round-trip OK')
  } catch (e) {
    console.error('WASM test failed:', e)
    compressorStatus.value = 'error'
    hasherStatus.value = 'error'
    uiStore.showError('WASM round-trip failed')
  }
}

async function probeSupabase() {
  probing.value = true
  supabaseError.value = ''
  try {
    if (!isConfigured()) {
      throw new Error('Supabase env vars are not set')
    }
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
    if (error) throw error
    dbConnected.value = true
    realtimeEnabled.value = true
  } catch (e) {
    supabaseError.value = e instanceof Error ? e.message : 'Probe failed'
    dbConnected.value = false
    realtimeEnabled.value = false
  } finally {
    probing.value = false
  }
}

function getStatusBadgeClass(status: string) {
  const classes: Record<string, string> = {
    planning: 'badge-info',
    active: 'badge-success',
    on_hold: 'badge-warning',
    completed: 'badge-secondary',
    archived: 'badge-secondary'
  }
  return classes[status] || ''
}

function exportData() {
  const data = {
    peerId: p2pStore.localPeerId,
    userId: authStore.userId,
    timestamp: new Date().toISOString()
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'earth-guardians-export.json'
  a.click()
  URL.revokeObjectURL(url)
}

async function runDiagnostics() {
  const diagnostics = {
    auth: authStore.isAuthenticated,
    supabase: dbConnected.value,
    realtime: realtimeEnabled.value,
    p2p: p2pStore.isConnected,
    peerId: p2pStore.localPeerId || null,
    wasm: wasmReady.value,
    route: route.fullPath
  }
  console.table(diagnostics)
  uiStore.showInfo('Diagnostics printed to console')
}

async function clearCache() {
  const ok = await uiStore.confirm('Clear all local cache (theme, peerId, session)?')
  if (!ok) return
  try {
    localStorage.clear()
    sessionStorage.clear()
    uiStore.showSuccess('Local cache cleared — reloading')
    setTimeout(() => window.location.reload(), 600)
  } catch (e) {
    console.error('Cache clear failed:', e)
  }
}

function openAuthModal() {
  uiStore.openAuthModal()
}

onMounted(async () => {
  // Real WASM init
  try {
    await initializeWasm()
    wasmReady.value = isWasmAvailable()
  } catch (e) {
    wasmReady.value = false
    wasmError.value = e instanceof Error ? e.message : 'WASM init failed'
  }

  // Real Supabase probe
  await probeSupabase()

  // Auth-only side effects
  if (authStore.isAuthenticated) {
    await projectsStore.fetchProjects({ limit: 5 })
    notificationsStore.fetchNotifications().catch((e) => console.error(e))
  }
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

.hero-title {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0 0 var(--spacing-md) 0;
}

.hero-sub {
  font-size: 1.125rem;
  color: var(--text-muted);
  max-width: 640px;
  margin: 0 auto var(--spacing-lg) auto;
}

.auth-prompt {
  max-width: 400px;
  margin: var(--spacing-lg) auto 0;
}

.peer-id {
  font-size: var(--text-xs);
  word-break: break-all;
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

.text-error {
  color: var(--error-color);
}

.text-sm {
  font-size: var(--text-sm);
}

.mt-sm {
  margin-top: var(--spacing-sm);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
}

.mt-xl { margin-top: var(--spacing-xl); }

@media (max-width: 768px) {
  .grid-cols-3,
  .actions-grid {
    grid-template-columns: 1fr;
  }
  .hero-title {
    font-size: 1.75rem;
  }
}
</style>
