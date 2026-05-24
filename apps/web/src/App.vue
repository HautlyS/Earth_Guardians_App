<template>
  <div id="earth-guardians-app">
    <header class="app-header">
      <nav class="nav">
        <h1 class="font-display text-xl">EARTH GUARDIANS</h1>
        <div class="flex gap-md">
          <router-link to="/" class="nav-item">Feed</router-link>
          <router-link to="/projects" class="nav-item">Projects</router-link>
          <router-link to="/docs" class="nav-item">Docs</router-link>
          <router-link to="/email" class="nav-item">Email</router-link>
        </div>
        <div class="theme-switcher">
          <button @click="setTheme('light')" :class="{ active: theme === 'light' }">☀️</button>
          <button @click="setTheme('dark')" :class="{ active: theme === 'dark' }">🌙</button>
          <button @click="setTheme('high-contrast')" :class="{ active: theme === 'high-contrast' }">⚡</button>
        </div>
      </nav>
    </header>
    <main class="app-main">
      <div class="container">
        <h2 class="text-3xl font-display mt-xl mb-lg">Welcome to Earth Guardians</h2>
        <p class="text-lg mb-xl">Neo-brutalist collaborative platform with P2P, WASM, and decentralized storage.</p>
        
        <div class="card mt-xl">
          <div class="card-header">
            <h3 class="card-title">P2P NETWORK STATUS</h3>
          </div>
          <div class="card-body">
            <p><strong>Peer ID:</strong> {{ peerId }}</p>
            <p><strong>Connected Peers:</strong> {{ connectedPeers }}</p>
            <p><strong>STUN Servers:</strong> {{ stunServers }}</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { p2pManager } from '../../../src/p2p/p2p-manager'

const theme = ref('light')
const peerId = ref('')
const connectedPeers = ref(0)
const stunServers = ref(0)

onMounted(() => {
  const stats = p2pManager.getStats()
  peerId.value = stats.peerId
  connectedPeers.value = stats.connectedPeers
  stunServers.value = stats.stunServers
})

function setTheme(t: string) {
  theme.value = t
  document.documentElement.setAttribute('data-theme', t)
}
</script>

<style scoped>
.app-header {
  border-bottom: 3px solid var(--border-color);
  background: var(--bg-primary);
}

.app-main {
  padding: var(--spacing-xl) 0;
  min-height: calc(100vh - 80px);
}
</style>
