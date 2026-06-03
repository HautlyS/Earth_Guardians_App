<template>
  <div class="p2p-view container">
    <h1 class="text-2xl font-display">P2P NETWORK</h1>
    <p class="text-muted">Peer-to-peer connectivity and networking</p>

    <div class="grid grid-cols-2 gap-xl mt-xl">
      <div class="card">
        <div class="card-header"><h3>Connection Status</h3></div>
        <div class="card-body">
          <p><strong>Status:</strong> <span :class="['badge', p2pStore.isConnected ? 'badge-success' : 'badge-warning']">
            {{ p2pStore.isConnected ? 'Connected' : 'Disconnected' }}
          </span></p>
          <p><strong>Peer ID:</strong> <code>{{ p2pStore.localPeerId || 'Not assigned' }}</code></p>
          <p><strong>Connected Peers:</strong> {{ p2pStore.connectedPeers.length }}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>STUN Servers</h3></div>
        <div class="card-body">
          <div v-for="server in p2pStore.stunServers" :key="server.host" class="server-item">
            <span>{{ server.host }}:{{ server.port }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt-xl">
      <div class="card-header"><h3>Actions</h3></div>
      <div class="card-body">
        <button @click="registerPeer" class="btn btn-primary mr-md" :disabled="p2pStore.loading">
          {{ p2pStore.loading ? 'Connecting...' : 'Connect to Network' }}
        </button>
        <button @click="p2pStore.disconnect()" class="btn btn-secondary" :disabled="!p2pStore.isConnected">
          Disconnect
        </button>
      </div>
    </div>

    <div v-if="p2pStore.onlinePeers.length > 0" class="card mt-xl">
      <div class="card-header"><h3>Online Peers ({{ p2pStore.onlinePeers.length }})</h3></div>
      <div class="card-body">
        <div v-for="peer in p2pStore.onlinePeers" :key="peer.id" class="peer-item">
          <span>{{ peer.peer_id }}</span>
          <span class="badge badge-success">Online</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useP2PStore } from '../stores/p2p'
import { useUIStore } from '../stores/ui'

const p2pStore = useP2PStore()
const uiStore = useUIStore()

async function registerPeer() {
  const peerId = `web_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`
  const result = await p2pStore.registerPeer(peerId)
  if (result.success) {
    uiStore.showSuccess('Connected to P2P network!')
  } else {
    uiStore.showError(result.error || 'Failed to connect')
  }
}
</script>

<style scoped>
.p2p-view { padding: var(--spacing-xl) 0; }
.mt-xl { margin-top: var(--spacing-xl); }
.mr-md { margin-right: var(--spacing-md); }
.server-item, .peer-item { display: flex; justify-content: space-between; padding: var(--spacing-sm); border-bottom: 1px solid var(--bg-secondary); }
</style>