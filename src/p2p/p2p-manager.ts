/**
 * Earth Guardians - P2P WebRTC Manager
 *
 * Pure WebRTC layer. Signaling transport is injected via setSignalingTransport.
 * Default transport is a no-op so the class is usable in tests; production wires
 * it to Supabase Realtime or a custom WebSocket gateway.
 */
import { FREE_STUN_SERVERS, STUNServer } from './stun-servers'

export interface P2PConfig {
  stunServers: STUNServer[]
  relayEnabled: boolean
  maxConnections: number
  chunkSize: number
  iceTransportPolicy?: RTCIceTransportPolicy
  signalingTransport?: SignalingTransport
}

export type SignalKind = 'offer' | 'answer' | 'ice-candidate' | 'leave'

export interface SignalEnvelope {
  kind: SignalKind
  fromPeerId: string
  toPeerId: string
  data: unknown
}

export interface SignalingTransport {
  send(signal: SignalEnvelope): void | Promise<void>
  onMessage(handler: (signal: SignalEnvelope) => void): () => void
}

export interface PeerConnection {
  peerId: string
  connection: RTCPeerConnection
  dataChannel?: RTCDataChannel
  metadata: Record<string, unknown>
}

export class P2PManager {
  private connections = new Map<string, PeerConnection>()
  private messageHandlers = new Map<string, ((data: unknown) => void)[]>()
  private signalHandlers: Array<(s: SignalEnvelope) => void> = []
  private localPeerId: string
  private rtcConfig: RTCConfiguration
  private outgoingChunkQueue = new Map<string, ArrayBuffer[]>()

  constructor(private config: P2PConfig) {
    this.localPeerId = this.generatePeerId()
    this.rtcConfig = this.buildRTCConfig()
    if (config.signalingTransport) this.bindTransport(config.signalingTransport)
  }

  static defaultConfig(): P2PConfig {
    return {
      stunServers: FREE_STUN_SERVERS,
      relayEnabled: true,
      maxConnections: 50,
      chunkSize: 65536,
    }
  }

  setSignalingTransport(transport: SignalingTransport): void {
    this.bindTransport(transport)
  }

  private bindTransport(transport: SignalingTransport): void {
    this.signalHandlers.push(
      transport.onMessage((signal) => {
        void this.handleSignal(signal)
      })
    )
  }

  private generatePeerId(): string {
    const bytes = new Uint8Array(16)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes)
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
    }
    let id = 'peer_'
    for (let i = 0; i < bytes.length; i++) id += bytes[i].toString(16).padStart(2, '0')
    return id
  }

  private buildRTCConfig(): RTCConfiguration {
    const iceServers: RTCIceServer[] = this.config.stunServers.map((s) => ({
      urls: [`stun:${s.host}:${s.port}`],
    }))
    return {
      iceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: this.config.iceTransportPolicy ?? 'all',
    }
  }

  getPeerId(): string {
    return this.localPeerId
  }

  setLocalPeerId(id: string): void {
    if (id && id.length > 0) this.localPeerId = id
  }

  createConnection(peerId: string, isInitiator = false): RTCPeerConnection {
    const existing = this.connections.get(peerId)
    if (existing) return existing.connection

    const connection = new RTCPeerConnection(this.rtcConfig)
    const peerRecord: PeerConnection = {
      peerId,
      connection,
      metadata: { createdAt: Date.now() },
    }
    this.connections.set(peerId, peerRecord)

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.broadcastSignal({
          kind: 'ice-candidate',
          fromPeerId: this.localPeerId,
          toPeerId: peerId,
          data: event.candidate.toJSON(),
        })
      }
    }
    connection.onconnectionstatechange = () => {
      const state = connection.connectionState
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.emit('disconnected', { peerId, state })
        if (state === 'failed') this.closeConnection(peerId)
      } else if (state === 'connected') {
        this.emit('connected', { peerId })
      }
    }
    connection.ondatachannel = (event) => {
      this.setupDataChannel(peerId, event.channel)
    }

    if (isInitiator) {
      const dc = connection.createDataChannel('p2p', { ordered: true })
      this.setupDataChannel(peerId, dc)
    }

    return connection
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    channel.binaryType = 'arraybuffer'
    const peer = this.connections.get(peerId)
    if (peer) peer.dataChannel = channel
    const incomingFile = { name: '', size: 0, totalChunks: 0, received: 0, buffer: [] as ArrayBuffer[] }

    channel.onopen = () => this.emit('data-channel-open', { peerId })
    channel.onclose = () => this.emit('data-channel-close', { peerId })
    channel.onerror = (e) => this.emit('data-channel-error', { peerId, error: e })
    channel.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        incomingFile.buffer.push(event.data)
        incomingFile.received++
        this.emit('transfer-progress', {
          peerId,
          fileName: incomingFile.name,
          progress: (incomingFile.received / incomingFile.totalChunks) * 100,
        })
        if (incomingFile.received === incomingFile.totalChunks) {
          const blob = new Blob(incomingFile.buffer)
          this.emit('file-received', { peerId, fileName: incomingFile.name, blob })
        }
        return
      }
      try {
        const message = JSON.parse(event.data as string) as {
          type: string
          payload?: unknown
        }
        if (message.type === 'file-start' && message.payload) {
          const p = message.payload as { fileName: string; fileSize: number; totalChunks: number }
          incomingFile.name = p.fileName
          incomingFile.size = p.fileSize
          incomingFile.totalChunks = p.totalChunks
          incomingFile.received = 0
          incomingFile.buffer = []
          this.emit('file-start', { peerId, ...p })
        } else if (message.type === 'file-complete') {
          this.emit('file-complete', { peerId, fileName: incomingFile.name })
        } else if (message.type === 'data') {
          this.emit('data', { peerId, payload: message.payload })
        } else {
          this.emit(message.type, { peerId, payload: message.payload })
        }
      } catch {
        this.emit('raw-data', { peerId, data: event.data })
      }
    }
  }

  private async handleSignal(signal: SignalEnvelope): Promise<void> {
    if (signal.toPeerId !== this.localPeerId) return
    const { fromPeerId, kind, data } = signal
    try {
      if (kind === 'offer') {
        await this.handleOffer(fromPeerId, data as RTCSessionDescriptionInit)
      } else if (kind === 'answer') {
        await this.handleAnswer(fromPeerId, data as RTCSessionDescriptionInit)
      } else if (kind === 'ice-candidate') {
        await this.handleCandidate(fromPeerId, data as RTCIceCandidateInit)
      } else if (kind === 'leave') {
        this.closeConnection(fromPeerId)
        this.emit('peer-left', { peerId: fromPeerId })
      }
    } catch (err) {
      this.emit('signal-error', { peerId: fromPeerId, kind, error: err })
    }
  }

  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.createConnection(peerId, true)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    this.broadcastSignal({
      kind: 'offer',
      fromPeerId: this.localPeerId,
      toPeerId: peerId,
      data: offer,
    })
    return offer
  }

  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const pc = this.createConnection(peerId, false)
    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    this.broadcastSignal({
      kind: 'answer',
      fromPeerId: this.localPeerId,
      toPeerId: peerId,
      data: answer,
    })
    return answer
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.connections.get(peerId)
    if (peer) await peer.connection.setRemoteDescription(new RTCSessionDescription(answer))
  }

  async handleCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.connections.get(peerId)
    if (peer && candidate) await peer.connection.addIceCandidate(new RTCIceCandidate(candidate))
  }

  private broadcastSignal(signal: SignalEnvelope): void {
    const transport = this.config.signalingTransport
    if (!transport) {
      this.emit('signal-no-transport', signal)
      return
    }
    void transport.send(signal)
  }

  send(peerId: string, data: unknown): boolean {
    const peer = this.connections.get(peerId)
    if (peer?.dataChannel?.readyState === 'open') {
      peer.dataChannel.send(
        JSON.stringify({ type: 'data', sender: this.localPeerId, timestamp: Date.now(), payload: data })
      )
      return true
    }
    return false
  }

  async sendFile(peerId: string, file: File): Promise<void> {
    const peer = this.connections.get(peerId)
    if (!peer?.dataChannel) throw new Error('No data channel to peer')
    if (peer.dataChannel.readyState !== 'open') {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (peer.dataChannel?.readyState === 'open') resolve()
          else setTimeout(check, 50)
        }
        check()
      })
    }
    const dc = peer.dataChannel
    const buffer = await file.arrayBuffer()
    const totalChunks = Math.ceil(buffer.byteLength / this.config.chunkSize)
    this.send(peerId, { type: 'file-start', payload: { fileName: file.name, fileSize: file.size, totalChunks } })
    for (let i = 0; i < totalChunks; i++) {
      const slice = buffer.slice(i * this.config.chunkSize, (i + 1) * this.config.chunkSize)
      if (dc.bufferedAmount > 16 * 1024 * 1024) {
        await new Promise((r) => setTimeout(r, 10))
      }
      dc.send(slice)
      this.emit('transfer-progress', {
        peerId,
        fileName: file.name,
        progress: ((i + 1) / totalChunks) * 100,
      })
    }
    this.send(peerId, { type: 'file-complete' })
  }

  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.messageHandlers.has(event)) this.messageHandlers.set(event, [])
    this.messageHandlers.get(event)!.push(handler)
    return () => this.off(event, handler)
  }

  off(event: string, handler: (data: unknown) => void): void {
    const handlers = this.messageHandlers.get(event)
    if (handlers) {
      const idx = handlers.indexOf(handler)
      if (idx > -1) handlers.splice(idx, 1)
    }
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.messageHandlers.get(event)
    if (!handlers) return
    for (const h of [...handlers]) {
      try {
        h(data)
      } catch (err) {
        console.error('[P2P] handler error', err)
      }
    }
  }

  getStats(): { peerId: string; connectedPeers: number; stunServers: number } {
    return {
      peerId: this.localPeerId,
      connectedPeers: this.getConnectedPeers().length,
      stunServers: this.config.stunServers.length,
    }
  }

  getConnectedPeers(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, p]) => p.dataChannel?.readyState === 'open')
      .map(([id]) => id)
  }

  closeConnection(peerId: string): void {
    const peer = this.connections.get(peerId)
    if (!peer) return
    try {
      peer.dataChannel?.close()
    } catch {
      // ignore
    }
    try {
      peer.connection.close()
    } catch {
      // ignore
    }
    this.connections.delete(peerId)
  }

  destroy(): void {
    Array.from(this.connections.keys()).forEach((id) => this.closeConnection(id))
    this.messageHandlers.clear()
    this.signalHandlers.length = 0
  }
}

let _singleton: P2PManager | null = null

export function getP2PManager(config?: P2PConfig): P2PManager {
  if (!_singleton) _singleton = new P2PManager(config ?? P2PManager.defaultConfig())
  return _singleton
}

export function resetP2PManager(): void {
  if (_singleton) {
    _singleton.destroy()
    _singleton = null
  }
}

export default P2PManager
