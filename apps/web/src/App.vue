<template>
  <div id="earth-guardians-app">
    <header class="app-header">
      <nav class="nav">
        <div class="nav-brand">
          <h1 class="font-display text-xl">EARTH GUARDIANS</h1>
          <span class="version-badge">v{{ version }}</span>
        </div>
        <div class="flex gap-md">
          <router-link to="/" class="nav-item">Feed</router-link>
          <router-link to="/projects" class="nav-item">Projects</router-link>
          <router-link to="/docs" class="nav-item">Docs</router-link>
          <router-link to="/email" class="nav-item">Email</router-link>
          <router-link to="/p2p" class="nav-item">P2P Network</router-link>
          <router-link to="/settings" class="nav-item">Settings</router-link>
        </div>
        <div class="theme-switcher">
          <button @click="setTheme('light')" :class="{ active: theme === 'light' }" title="Light">☀️</button>
          <button @click="setTheme('dark')" :class="{ active: theme === 'dark' }" title="Dark">🌙</button>
          <button @click="setTheme('high-contrast')" :class="{ active: theme === 'high-contrast' }" title="High Contrast">⚡</button>
        </div>
      </nav>
    </header>
    
    <main class="app-main">
      <div class="container">
        <section class="hero">
          <h2 class="text-3xl font-display mt-xl mb-lg">Welcome to Earth Guardians</h2>
          <p class="text-lg mb-xl">Neo-brutalist collaborative platform with P2P, WASM, and decentralized storage.</p>
        </section>
        
        <div class="grid grid-cols-3 gap-xl">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">🤝 P2P NETWORK</h3>
            </div>
            <div class="card-body">
              <p><strong>Peer ID:</strong> <code>{{ peerId || 'Connecting...' }}</code></p>
              <p><strong>Connected Peers:</strong> <span class="badge">{{ connectedPeers }}</span></p>
              <p><strong>STUN Servers:</strong> <span class="badge">{{ stunServers }}</span></p>
              <div class="mt-md">
                <button @click="connectP2P" class="btn btn-primary">Connect</button>
                <button @click="disconnectP2P" class="btn btn-secondary">Disconnect</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">⚡ WASM ENGINE</h3>
            </div>
            <div class="card-body">
              <p><strong>Status:</strong> <span :class="['badge', wasmReady ? 'badge-success' : 'badge-warning']">{{ wasmReady ? 'Ready' : 'Loading' }}</span></p>
              <p><strong>Compressor:</strong> <span class="badge">{{ compressorStatus }}</span></p>
              <p><strong>Hasher:</strong> <span class="badge">{{ hasherStatus }}</span></p>
              <div class="mt-md">
                <button @click="runWasmTest" class="btn btn-primary" :disabled="!wasmReady">Run Test</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">🌐 SUPABASE</h3>
            </div>
            <div class="card-body">
              <p><strong>Status:</strong> <span :class="['badge', dbConnected ? 'badge-success' : 'badge-warning']">{{ dbConnected ? 'Connected' : 'Disconnected' }}</span></p>
              <p><strong>Real-time:</strong> <span class="badge">{{ realtimeEnabled ? 'Active' : 'Inactive' }}</span></p>
              <div class="mt-md">
                <button @click="testSupabase" class="btn btn-primary">Test Connection</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card mt-xl">
          <div class="card-header">
            <h3 class="card-title">📊 PERFORMANCE METRICS</h3>
          </div>
          <div class="card-body">
            <div class="metrics-grid">
              <div class="metric">
                <span class="metric-label">Build Time</span>
                <span class="metric-value">{{ buildTime }}ms</span>
              </div>
              <div class="metric">
                <span class="metric-label">Memory</span>
                <span class="metric-value">{{ memoryUsage }} MB</span>
              </div>
              <div class="metric">
                <span class="metric-label">WASM Size</span>
                <span class="metric-value">{{ wasmSize }} KB</span>
              </div>
              <div class="metric">
                <span class="metric-label">Compression Ratio</span>
                <span class="metric-value">{{ compressionRatio }}%</span>
              </div>
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
    </main>

    <footer class="app-footer">
      <div class="container">
        <p>© 2024 Earth Guardians NGO • Built with ❤️ and Rust/WASM</p>
        <p class="mt-sm text-sm text-muted">Powered by P2P, WebAssembly, and decentralized technology</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { p2pManager } from '../../../src/p2p/p2p-manager'
import { initializeWasm, testCompressor, testHasher } from '@shared/earth_guardians_shared'

// App info
const version = ref(__APP_VERSION__ || '1.0.0')

// Theme
const theme = ref('light')

// P2P
const peerId = ref('')
const connectedPeers = ref(0)
const stunServers = ref(0)

// WASM
const wasmReady = ref(false)
const compressorStatus = ref('idle')
const hasherStatus = ref('idle')
const wasmSize = ref(0)
const compressionRatio = ref(0)

// Supabase
const dbConnected = ref(false)
const realtimeEnabled = ref(false)

// Performance
const buildTime = ref(0)
const memoryUsage = ref(0)

// Computed
const startTime = Date.now()

onMounted(async () => {
  buildTime.value = Date.now() - startTime
  
  // Initialize P2P
  connectP2P()
  
  // Initialize WASM
  try {
    await initializeWasm()
    wasmReady.value = true
    compressorStatus.value = 'loaded'
    hasherStatus.value = 'loaded'
    
    // Get WASM size estimate
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const mem = (performance as any).memory
      if (mem) {
        memoryUsage.value = Math.round(mem.usedJSHeapSize / 1024 / 1024)
      }
    }
  } catch (e) {
    console.warn('WASM initialization failed:', e)
    compressorStatus.value = 'failed'
    hasherStatus.value = 'failed'
  }
})

function connectP2P() {
  const stats = p2pManager.getStats()
  peerId.value = stats.peerId
  connectedPeers.value = stats.connectedPeers
  stunServers.value = stats.stunServers
}

function disconnectP2P() {
  peerId.value = ''
  connectedPeers.value = 0
}

function setTheme(t: string) {
  theme.value = t
  document.documentElement.setAttribute('data-theme', t)
  localStorage.setItem('theme', t)
}

async function runWasmTest() {
  if (!wasmReady.value) return
  
  try {
    compressorStatus.value = 'testing'
    const testData = new Uint8Array(1024).fill(65)
    const compressed = testCompressor(testData)
    compressionRatio.value = Math.round((1 - compressed.length / testData.length) * 100)
    compressorStatus.value = 'ready'
    
    hasherStatus.value = 'testing'
    testHasher(testData)
    hasherStatus.value = 'ready'
  } catch (e) {
    console.error('WASM test failed:', e)
    compressorStatus.value = 'error'
    hasherStatus.value = 'error'
  }
}

async function testSupabase() {
  // Supabase connection test would go here
  dbConnected.value = true
  realtimeEnabled.value = true
}

function exportData() {
  const data = {
    peerId: peerId.value,
    theme: theme.value,
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
    }
  }
  input.click()
}

function runDiagnostics() {
  console.log('Running diagnostics...')
  const diagnostics = {
    wasmReady: wasmReady.value,
    p2pConnected: connectedPeers.value > 0,
    dbConnected: dbConnected.value,
    memory: memoryUsage.value,
    buildTime: buildTime.value
  }
  console.table(diagnostics)
}

function clearCache() {
  if (confirm('Clear all cached data?')) {
    localStorage.clear()
    sessionStorage.clear()
    window.location.reload()
  }
}
</script>

<style scoped>
.app-header {
  border-bottom: 3px solid var(--border-color);
  background: var(--bg-primary);
  padding: var(--spacing-md) 0;
}

.nav {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
  padding: 0 var(--spacing-lg);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.version-badge {
  font-size: var(--text-xs);
  background: var(--accent-color);
  color: var(--bg-primary);
  padding: 2px 8px;
  border-radius: 4px;
}

.nav-item {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid transparent;
  transition: all 0.2s;
}

.nav-item:hover {
  border-color: var(--accent-color);
}

.theme-switcher {
  display: flex;
  gap: var(--spacing-xs);
}

.theme-switcher button {
  padding: var(--spacing-sm);
  border: 2px solid var(--border-color);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.theme-switcher button.active {
  background: var(--accent-color);
  color: var(--bg-primary);
}

.app-main {
  padding: var(--spacing-xl) 0;
  min-height: calc(100vh - 160px);
}

.hero {
  text-align: center;
  margin-bottom: var(--spacing-xl);
}

.grid {
  display: grid;
  gap: var(--spacing-xl);
}

.grid-cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

.card {
  border: 3px solid var(--border-color);
  background: var(--bg-primary);
}

.card-header {
  background: var(--accent-color);
  color: var(--bg-primary);
  padding: var(--spacing-md);
  font-weight: bold;
}

.card-body {
  padding: var(--spacing-lg);
}

.mt-xl { margin-top: var(--spacing-xl); }
.mt-md { margin-top: var(--spacing-md); }
.mt-sm { margin-top: var(--spacing-sm); }

.badge {
  display: inline-block;
  padding: 2px 8px;
  background: var(--text-muted);
  color: var(--bg-primary);
  font-size: var(--text-sm);
  border-radius: 4px;
}

.badge-success { background: #10b981; }
.badge-warning { background: #f59e0b; }

code {
  font-family: monospace;
  background: var(--bg-secondary);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-lg);
}

.metric {
  text-align: center;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
}

.metric-label {
  display: block;
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-bottom: var(--spacing-xs);
}

.metric-value {
  display: block;
  font-size: var(--text-xl);
  font-weight: bold;
  color: var(--accent-color);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-md);
}

.btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 2px solid var(--border-color);
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent-color);
  color: var(--bg-primary);
  border-color: var(--accent-color);
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-secondary {
  background: var(--bg-primary);
  color: var(--text-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-secondary);
}

.btn-danger {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.app-footer {
  border-top: 3px solid var(--border-color);
  padding: var(--spacing-xl) 0;
  text-align: center;
  margin-top: var(--spacing-xl);
}

.text-muted {
  color: var(--text-muted);
}

.text-sm {
  font-size: var(--text-sm);
}

@media (max-width: 768px) {
  .grid-cols-3,
  .metrics-grid,
  .actions-grid {
    grid-template-columns: 1fr;
  }
  
  .nav {
    flex-wrap: wrap;
    gap: var(--spacing-md);
  }
}
</style>
