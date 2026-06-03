/**
 * P2P Store
 * Earth Guardians Platform
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

export interface Peer {
  id: string
  user_id: string
  peer_id: string
  public_key?: string
  is_online: boolean
  last_seen_at?: string
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export const useP2PStore = defineStore('p2p', () => {
  // State
  const localPeerId = ref<string>('')
  const peers = ref<Peer[]>([])
  const connectedPeers = ref<string[]>([])
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const loading = ref(false)
  const error = ref<string | null>(null)
  const stunServers = ref<{ host: string; port: number }[]>([
    { host: 'stun.l.google.com', port: 19302 }
  ])

  // Getters
  const isConnected = computed(() => connectionStatus.value === 'connected')
  const onlinePeers = computed(() => peers.value.filter(p => p.is_online))
  const peerCount = computed(() => connectedPeers.value.length)

  // Actions
  async function registerPeer(peerId: string, publicKey?: string) {
    loading.value = true
    error.value = null

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error: registerError } = await supabase
        .from('p2p_peers')
        .upsert({
          user_id: user.id,
          peer_id: peerId,
          public_key: publicKey,
          is_online: true,
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .single()

      if (registerError) throw registerError

      localPeerId.value = peerId

      // Fetch online peers
      await fetchOnlinePeers()

      connectionStatus.value = 'connected'
      return { success: true, peer: data }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to register peer'
      connectionStatus.value = 'error'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function fetchOnlinePeers() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: fetchError } = await supabase
        .from('p2p_peers')
        .select('*')
        .eq('is_online', true)
        .neq('user_id', user.id)
        .limit(50)

      if (fetchError) throw fetchError

      peers.value = data || []
    } catch (e) {
      console.error('Fetch online peers failed:', e)
    }
  }

  async function sendSignal(toPeerId: string, signalType: string, payload: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: signalError } = await supabase
        .from('p2p_signaling')
        .insert({
          from_peer_id: user.id,
          to_peer_id: toPeerId,
          signal_type: signalType,
          payload
        })

      if (signalError) throw signalError

      return { success: true }
    } catch (e) {
      console.error('Send signal failed:', e)
      return { success: false, error: e instanceof Error ? e.message : 'Failed to send signal' }
    }
  }

  async function disconnect() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('p2p_peers')
        .update({ is_online: false })
        .eq('user_id', user.id)

      localPeerId.value = ''
      connectedPeers.value = []
      connectionStatus.value = 'disconnected'
    } catch (e) {
      console.error('Disconnect failed:', e)
    }
  }

  function addConnectedPeer(peerId: string) {
    if (!connectedPeers.value.includes(peerId)) {
      connectedPeers.value.push(peerId)
    }
  }

  function removeConnectedPeer(peerId: string) {
    connectedPeers.value = connectedPeers.value.filter(id => id !== peerId)
  }

  function subscribeToSignals(userId: string, handlers: {
    onOffer?: (from: string, offer: any) => void
    onAnswer?: (from: string, answer: any) => void
    onIceCandidate?: (from: string, candidate: any) => void
    onLeave?: (from: string) => void
  }) {
    const channel = supabase.channel(`p2p-signaling-${userId}`)

    channel.on('broadcast', { event: 'signal' }, (payload) => {
      const { from_peer_id, signal_type, payload: signalData } = payload.payload
      
      switch (signal_type) {
        case 'offer':
          handlers.onOffer?.(from_peer_id, signalData)
          break
        case 'answer':
          handlers.onAnswer?.(from_peer_id, signalData)
          break
        case 'ice-candidate':
          handlers.onIceCandidate?.(from_peer_id, signalData)
          break
        case 'leave':
          handlers.onLeave?.(from_peer_id)
          removeConnectedPeer(from_peer_id)
          break
      }
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: userId, online_at: new Date().toISOString() })
      }
    })

    return channel
  }

  return {
    // State
    localPeerId,
    peers,
    connectedPeers,
    connectionStatus,
    loading,
    error,
    stunServers,

    // Getters
    isConnected,
    onlinePeers,
    peerCount,

    // Actions
    registerPeer,
    fetchOnlinePeers,
    sendSignal,
    disconnect,
    addConnectedPeer,
    removeConnectedPeer,
    subscribeToSignals
  }
})