/**
 * P2P Store
 * Earth Guardians Platform
 */
import { defineStore } from 'pinia'
import { ref, computed, onScopeDispose } from 'vue'
import { supabase } from '../lib/supabase'
import { getP2PManager, type SignalEnvelope } from '../../../src/p2p/p2p-manager'

export interface Peer {
  id: string
  user_id: string
  peer_id: string
  public_key?: string | null
  is_online: boolean
  last_seen_at?: string | null
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const PEER_ID_KEY = 'eg:peerId'

function readStoredPeerId(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(PEER_ID_KEY) ?? ''
}

function writeStoredPeerId(id: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PEER_ID_KEY, id)
  } catch {
    // ignore quota
  }
}

function clearStoredPeerId(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(PEER_ID_KEY)
  } catch {
    // ignore
  }
}

export const useP2PStore = defineStore('p2p', () => {
  const localPeerId = ref<string>(readStoredPeerId())
  const peers = ref<Peer[]>([])
  const connectedPeers = ref<string[]>([])
  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const loading = ref(false)
  const error = ref<string | null>(null)
  const stunServers = ref<{ host: string; port: number }[]>([
    { host: 'stun.l.google.com', port: 19302 },
  ])

  const isConnected = computed(() => connectionStatus.value === 'connected')
  const onlinePeers = computed(() => peers.value.filter((p) => p.is_online))
  const peerCount = computed(() => connectedPeers.value.length)

  function ensureManager() {
    const mgr = getP2PManager()
    if (localPeerId.value) mgr.setLocalPeerId(localPeerId.value)
    mgr.on('connected', (data: unknown) => {
      const d = data as { peerId: string }
      if (!connectedPeers.value.includes(d.peerId)) connectedPeers.value.push(d.peerId)
    })
    mgr.on('disconnected', (data: unknown) => {
      const d = data as { peerId: string }
      connectedPeers.value = connectedPeers.value.filter((id) => id !== d.peerId)
    })
    mgr.on('peer-left', (data: unknown) => {
      const d = data as { peerId: string }
      connectedPeers.value = connectedPeers.value.filter((id) => id !== d.peerId)
    })
    mgr.on('signal-no-transport', (data: unknown) => {
      // Signaling transport not configured — relay via supabase signaling table
      const env = data as SignalEnvelope
      void sendSignal(env.toPeerId, env.kind, env.data)
    })
    return mgr
  }

  async function registerPeer(publicKey?: string): Promise<{ success: boolean; peer?: Peer; error?: string }> {
    loading.value = true
    error.value = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (!localPeerId.value) {
        const mgr = ensureManager()
        localPeerId.value = mgr.getPeerId()
        writeStoredPeerId(localPeerId.value)
      }

      const { data, error: registerError } = await supabase
        .from('p2p_peers')
        .upsert(
          {
            user_id: user.id,
            peer_id: localPeerId.value,
            public_key: publicKey ?? null,
            is_online: true,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .single()

      if (registerError) throw registerError

      await fetchOnlinePeers()
      connectionStatus.value = 'connected'
      ensureManager()
      return { success: true, peer: data as Peer }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to register peer'
      error.value = msg
      connectionStatus.value = 'error'
      return { success: false, error: msg }
    } finally {
      loading.value = false
    }
  }

  async function fetchOnlinePeers(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error: fetchError } = await supabase
        .from('p2p_peers')
        .select('*')
        .eq('is_online', true)
        .neq('user_id', user.id)
        .order('last_seen_at', { ascending: false })
        .limit(50)
      if (fetchError) throw fetchError
      peers.value = (data ?? []) as Peer[]
    } catch (e) {
      console.error('Fetch online peers failed:', e)
    }
  }

  async function sendSignal(toUserId: string, signalType: string, payload: unknown): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error: signalError } = await supabase.from('p2p_signaling').insert({
        from_peer_id: user.id,
        to_peer_id: toUserId,
        signal_type: signalType,
        payload: payload as Record<string, unknown>,
      })
      if (signalError) throw signalError
      return { success: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send signal'
      console.error('Send signal failed:', e)
      return { success: false, error: msg }
    }
  }

  async function invitePeer(targetUserId: string): Promise<void> {
    if (!localPeerId.value) await registerPeer()
    const mgr = ensureManager()
    try {
      await mgr.createOffer(targetUserId)
    } catch (e) {
      console.error('Failed to create offer', e)
    }
  }

  async function disconnect(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('p2p_peers')
          .update({ is_online: false, last_seen_at: new Date().toISOString() })
          .eq('user_id', user.id)
      }
    } catch (e) {
      console.error('Disconnect failed:', e)
    } finally {
      localPeerId.value = ''
      clearStoredPeerId()
      connectedPeers.value = []
      connectionStatus.value = 'disconnected'
    }
  }

  function addConnectedPeer(peerId: string): void {
    if (!connectedPeers.value.includes(peerId)) connectedPeers.value.push(peerId)
  }
  function removeConnectedPeer(peerId: string): void {
    connectedPeers.value = connectedPeers.value.filter((id) => id !== peerId)
  }

  let signalingChannel: ReturnType<typeof supabase.channel> | null = null

  function subscribeToSignals(): void {
    if (signalingChannel) return
    signalingChannel = supabase
      .channel('p2p-signaling-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'p2p_signaling' },
        async (payload) => {
          const row = payload.new as {
            from_peer_id: string
            signal_type: string
            payload: unknown
          }
          const { data: { user } } = await supabase.auth.getUser()
          if (!user || row.from_peer_id === user.id) return
          const mgr = ensureManager()
          await mgr['handleSignal']({
            kind: row.signal_type as 'offer' | 'answer' | 'ice-candidate' | 'leave',
            fromPeerId: row.from_peer_id,
            toPeerId: user.id,
            data: row.payload,
          })
        }
      )
      .subscribe()
  }

  function unsubscribeFromSignals(): void {
    if (signalingChannel) {
      void supabase.removeChannel(signalingChannel)
      signalingChannel = null
    }
  }

  onScopeDispose(() => unsubscribeFromSignals())

  return {
    localPeerId,
    peers,
    connectedPeers,
    connectionStatus,
    loading,
    error,
    stunServers,
    isConnected,
    onlinePeers,
    peerCount,
    registerPeer,
    fetchOnlinePeers,
    sendSignal,
    invitePeer,
    disconnect,
    addConnectedPeer,
    removeConnectedPeer,
    subscribeToSignals,
    unsubscribeFromSignals,
  }
})
