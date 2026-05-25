/**
 * P2P Manager - Stub implementation for Web
 * Real P2P functionality will be provided by desktop native bindings
 */

export interface P2PStats {
  peerId: string
  connectedPeers: number
  stunServers: number
}

class P2PManager {
  private connected = false
  private peerIdValue = ''

  async connect(): Promise<void> {
    // Generate a peer ID for this session
    this.peerIdValue = `web_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`
    this.connected = true
    console.log('[P2P] Web stub connected, peer ID:', this.peerIdValue)
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.peerIdValue = ''
    console.log('[P2P] Web stub disconnected')
  }

  getStats(): P2PStats {
    return {
      peerId: this.peerIdValue,
      connectedPeers: this.connected ? 1 : 0,
      stunServers: 0
    }
  }

  isConnected(): boolean {
    return this.connected
  }
}

export const p2pManager = new P2PManager()
