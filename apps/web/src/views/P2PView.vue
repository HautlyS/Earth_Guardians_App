<template>
  <div class="p2p-view container">
    <h1 class="page-title">P2P Network</h1>
    <p class="text-muted">Peer-to-peer connectivity via WebRTC and the Supabase signaling channel.</p>

    <div v-if="!authStore.isAuthenticated" class="auth-required card">
      <div class="card-body">
        <p>Sign in to connect to the P2P network.</p>
        <button class="btn btn-primary" @click="uiStore.openAuthModal()">Sign in</button>
      </div>
    </div>

    <div v-else class="grid grid-cols-2 gap-xl mt-xl">
      <div class="card">
        <div class="card-header"><h3>Connection Status</h3></div>
        <div class="card-body">
          <p>
            <strong>Status:</strong>
            <span :class="['badge', p2pStore.isConnected ? 'badge-success' : 'badge-warning']">
              {{ p2pStore.isConnected ? 'Connected' : 'Disconnected' }}
            </span>
          </p>
          <p><strong>Peer ID:</strong> <code class="peer-id">{{ p2pStore.localPeerId || 'Not assigned' }}</code></p>
          <p><strong>Connected Peers:</strong> {{ p2pStore.connectedPeers.length }}</p>
          <div class="mt-md">
            <button @click="onConnect" class="btn btn-primary" :disabled="p2pStore.loading">
              {{ p2pStore.loading ? 'Connecting…' : (p2pStore.isConnected ? 'Reconnect' : 'Connect') }}
            </button>
            <button @click="p2pStore.disconnect()" class="btn btn-secondary" :disabled="!p2pStore.isConnected">
              Disconnect
            </button>
          </div>
          <p v-if="p2pStore.error" class="text-error text-sm mt-sm">{{ p2pStore.error }}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>STUN Servers</h3></div>
        <div class="card-body">
          <ul class="server-list">
            <li v-for="server in p2pStore.stunServers" :key="`${server.host}:${server.port}`">
              <code>{{ server.host }}:{{ server.port }}</code>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div v-if="authStore.isAuthenticated" class="card mt-xl">
      <div class="card-header">
        <h3>Online Peers ({{ p2pStore.onlinePeers.length }})</h3>
        <button @click="p2pStore.fetchOnlinePeers()" class="btn btn-secondary" :disabled="p2pStore.loading">
          Refresh
        </button>
      </div>
      <div class="card-body">
        <div v-if="p2pStore.onlinePeers.length === 0" class="empty-state">
          <p>No online peers yet.</p>
        </div>
        <ul v-else class="peer-list">
          <li v-for="peer in p2pStore.onlinePeers" :key="peer.id" class="peer-item">
            <div class="peer-info">
              <code class="peer-id">{{ peer.peer_id }}</code>
              <span class="text-muted text-xs">last seen {{ formatTime(peer.last_seen_at) }}</span>
            </div>
            <div class="peer-actions">
              <span :class="['badge', isConnectedTo(peer.peer_id) ? 'badge-success' : 'badge-secondary']">
                {{ isConnectedTo(peer.peer_id) ? 'Connected' : 'Available' }}
              </span>
              <button
                v-if="!isConnectedTo(peer.peer_id)"
                class="btn btn-primary"
                @click="invite(peer.user_id)"
                :disabled="!p2pStore.isConnected"
              >
                Connect
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useP2PStore } from '../stores/p2p'
import { useUIStore } from '../stores/ui'

const authStore = useAuthStore()
const p2pStore = useP2PStore()
const uiStore = useUIStore()

function isConnectedTo(peerId: string) {
  return p2pStore.connectedPeers.includes(peerId)
}

function formatTime(iso?: string | null) {
  if (!iso) return 'unknown'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'unknown'
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString()
}

async function onConnect() {
  const result = await p2pStore.registerPeer()
  if (result.success) {
    p2pStore.subscribeToSignals()
    uiStore.showSuccess('P2P network ready')
  } else {
    uiStore.showError(result.error || 'Failed to connect')
  }
}

async function invite(targetUserId: string) {
  try {
    await p2pStore.invitePeer(targetUserId)
    uiStore.showInfo('Offer sent — waiting for answer')
  } catch (e) {
    console.error('Invite failed:', e)
    uiStore.showError('Failed to send invite')
  }
}

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await p2pStore.fetchOnlinePeers()
  }
})
</script>

<style scoped>
.p2p-view { padding: var(--spacing-xl) 0; }
.page-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
.mt-xl { margin-top: var(--spacing-xl); }
.mt-md { margin-top: var(--spacing-md); }
.mt-sm { margin-top: var(--spacing-sm); }
.text-muted { color: var(--text-muted); }
.text-xs { font-size: var(--text-xs); }
.text-error { color: var(--error-color); }
.peer-id { font-size: var(--text-xs); word-break: break-all; }
.server-list, .peer-list { list-style: none; padding: 0; margin: 0; }
.server-list li, .peer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--bg-secondary);
  gap: var(--spacing-md);
}
.peer-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.peer-actions { display: flex; align-items: center; gap: var(--spacing-sm); }
.empty-state { text-align: center; padding: var(--spacing-lg); color: var(--text-muted); }
.auth-required { max-width: 480px; margin: var(--spacing-xl) auto; text-align: center; }

@media (max-width: 768px) {
  .grid-cols-2 { grid-template-columns: 1fr; }
}
</style>
