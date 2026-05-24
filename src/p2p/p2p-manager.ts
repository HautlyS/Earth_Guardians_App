/**
 * P2P Manager - Decentralized Atomic P2P
 * 
 * Uses free STUN servers for NAT traversal and peer discovery
 * Based on WebRTC for true decentralized communication
 */

import { 
  P2P_CONFIG, 
  STUN_LIST_URL, 
  getRandomSTUNServer, 
  getSTUNServers, 
  STUNServer,
  FREE_STUN_SERVERS 
} from './stun-servers';

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  metadata: PeerMetadata;
}

export interface PeerMetadata {
  name?: string;
  deviceType?: string;
  publicKey?: string;
  joinedAt: number;
}

export interface P2PMessage {
  type: 'signal' | 'data' | 'discovery' | 'sync';
  sender: string;
  timestamp: number;
  payload: any;
}

export interface STUNRefreshResult {
  servers: string[];
  timestamp: number;
  source: string;
}

class P2PManager {
  private peerConnections: Map<string, PeerConnection> = new Map();
  private localPeerId: string;
  private rtcConfig: RTCConfiguration;
  private messageHandlers: Map<string, (msg: P2PMessage) => void> = new Map();
  private stunRefreshInterval: NodeJS.Timeout | null = null;
  private dataChannels: Map<string, RTCDataChannel> = new Map();

  constructor() {
    this.localPeerId = this.generatePeerId();
    this.rtcConfig = this.buildRTCConfig();
    this.startSTUNRefresh();
  }

  /**
   * Generate a unique peer ID
   */
  private generatePeerId(): string {
    return `peer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Build RTC Configuration using free STUN servers
   */
  private buildRTCConfig(): RTCConfiguration {
    const iceServers = P2P_CONFIG.stunServers.map(server => ({
      urls: [
        `stun:${server.host}:${server.port}`,
        `stun:${server.host}:${server.port}?transport=udp`
      ],
      username: '',
      credential: ''
    }));

    return {
      iceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };
  }

  /**
   * Start periodic STUN server list refresh
   */
  private startSTUNRefresh(): void {
    // Refresh every hour (as per the URL's refresh rate)
    this.stunRefreshInterval = setInterval(async () => {
      await this.refreshSTUNServers();
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Refresh STUN server list from remote source
   */
  async refreshSTUNServers(): Promise<STUNRefreshResult> {
    try {
      const response = await fetch(STUN_LIST_URL, {
        cache: 'no-cache',
        headers: {
          'Accept': 'text/plain'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch STUN list: ${response.status}`);
      }

      const text = await response.text();
      const servers = text
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.trim());

      // Update RTC config with new servers
      const newIceServers = servers.map(host => ({
        urls: [
          `stun:${host}`,
          `stun:${host}?transport=udp`
        ],
        username: '',
        credential: ''
      }));

      // Add default servers as fallback
      newIceServers.push(...P2P_CONFIG.stunServers.map(server => ({
        urls: [`stun:${server.host}:${server.port}`],
        username: '',
        credential: ''
      })));

      this.rtcConfig.iceServers = newIceServers;

      return {
        servers,
        timestamp: Date.now(),
        source: STUN_LIST_URL
      };
    } catch (error) {
      console.warn('Failed to refresh STUN servers, using defaults:', error);
      return {
        servers: FREE_STUN_SERVERS.map(s => s.url),
        timestamp: Date.now(),
        source: 'local-cache'
      };
    }
  }

  /**
   * Create a peer connection
   */
  createPeerConnection(peerId: string): RTCPeerConnection {
    const existingConn = this.peerConnections.get(peerId);
    if (existingConn) {
      return existingConn.connection;
    }

    const connection = new RTCPeerConnection(this.rtcConfig);

    // Set up ICE candidate handler
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.handleICECandidate(peerId, event.candidate);
      }
    };

    connection.oniceconnectionstatechange = () => {
      this.handleConnectionStateChange(peerId, connection.iceConnectionState);
    };

    connection.ontrack = (event) => {
      this.handleTrack(peerId, event);
    };

    // Create data channel
    const dataChannel = connection.createDataChannel('p2p_data', {
      ordered: true
    });

    this.setupDataChannel(peerId, dataChannel);

    this.peerConnections.set(peerId, {
      peerId,
      connection,
      dataChannel,
      metadata: {
        joinedAt: Date.now()
      }
    });

    return connection;
  }

  /**
   * Setup data channel handlers
   */
  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log(`Data channel open with peer: ${peerId}`);
      this.notifyMessageHandlers('connected', { peerId });
    };

    channel.onclose = () => {
      console.log(`Data channel closed with peer: ${peerId}`);
      this.notifyMessageHandlers('disconnected', { peerId });
    };

    channel.onmessage = (event) => {
      try {
        const message: P2PMessage = JSON.parse(event.data);
        this.handleIncomingMessage(peerId, message);
      } catch (error) {
        console.error('Failed to parse P2P message:', error);
      }
    };

    channel.onerror = (error) => {
      console.error(`Data channel error with peer ${peerId}:`, error);
    };

    this.dataChannels.set(peerId, channel);
  }

  /**
   * Handle ICE candidate
   */
  private handleICECandidate(peerId: string, candidate: RTCIceCandidate): void {
    const message: P2PMessage = {
      type: 'signal',
      sender: this.localPeerId,
      timestamp: Date.now(),
      payload: {
        action: 'ice-candidate',
        targetPeer: peerId,
        candidate: candidate.toJSON()
      }
    };
    this.broadcastMessage(message);
  }

  /**
   * Handle connection state changes
   */
  private handleConnectionStateChange(peerId: string, state: RTCIceConnectionState): void {
    console.log(`Connection state with ${peerId}: ${state}`);
    
    switch (state) {
      case 'connected':
        this.notifyMessageHandlers('connected', { peerId });
        break;
      case 'disconnected':
      case 'failed':
        this.notifyMessageHandlers('disconnected', { peerId });
        this.cleanupPeerConnection(peerId);
        break;
    }
  }

  /**
   * Handle incoming track
   */
  private handleTrack(peerId: string, event: RTCTrackEvent): void {
    console.log(`Received track from ${peerId}:`, event.streams);
    // Handle media streams as needed
  }

  /**
   * Create offer for peer connection
   */
  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const connection = this.createPeerConnection(peerId);
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    const signalMessage: P2PMessage = {
      type: 'signal',
      sender: this.localPeerId,
      timestamp: Date.now(),
      payload: {
        action: 'offer',
        targetPeer: peerId,
        offer: offer
      }
    };

    return offer;
  }

  /**
   * Handle incoming offer
   */
  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const connection = this.createPeerConnection(peerId);
    await connection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    return answer;
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  async handleICECandidateMessage(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  /**
   * Handle incoming P2P message
   */
  private handleIncomingMessage(peerId: string, message: P2PMessage): void {
    // Dispatch to appropriate handlers
    switch (message.type) {
      case 'signal':
        this.handleSignalMessage(peerId, message.payload);
        break;
      case 'data':
        this.notifyMessageHandlers('data', message.payload);
        break;
      case 'discovery':
        this.handleDiscoveryMessage(message.payload);
        break;
      case 'sync':
        this.notifyMessageHandlers('sync', message.payload);
        break;
    }
  }

  /**
   * Handle signal messages (offer/answer/ice-candidate)
   */
  private async handleSignalMessage(peerId: string, payload: any): Promise<void> {
    switch (payload.action) {
      case 'offer':
        await this.handleOffer(peerId, payload.offer);
        break;
      case 'answer':
        await this.handleAnswer(peerId, payload.answer);
        break;
      case 'ice-candidate':
        await this.handleICECandidateMessage(peerId, payload.candidate);
        break;
    }
  }

  /**
   * Handle discovery messages
   */
  private handleDiscoveryMessage(payload: any): void {
    this.notifyMessageHandlers('discovery', payload);
  }

  /**
   * Send message to a specific peer
   */
  sendToPeer(peerId: string, data: any): boolean {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === 'open') {
      const message: P2PMessage = {
        type: 'data',
        sender: this.localPeerId,
        timestamp: Date.now(),
        payload: data
      };
      channel.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Broadcast message to all connected peers
   */
  broadcastMessage(message: P2PMessage): void {
    this.dataChannels.forEach((channel, peerId) => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Register message handler
   */
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Notify message handlers
   */
  private notifyMessageHandlers(type: string, data: any): void {
    const handler = this.messageHandlers.get(type);
    if (handler) {
      handler(data);
    }
  }

  /**
   * Cleanup peer connection
   */
  private cleanupPeerConnection(peerId: string): void {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      peer.dataChannel?.close();
      peer.connection.close();
      this.peerConnections.delete(peerId);
      this.dataChannels.delete(peerId);
    }
  }

  /**
   * Get peer statistics
   */
  getPeerStats(): {
    localPeerId: string;
    connectedPeers: number;
    stunServersCount: number;
    lastSTUNRefresh: number;
  } {
    return {
      localPeerId: this.localPeerId,
      connectedPeers: this.peerConnections.size,
      stunServersCount: this.rtcConfig.iceServers?.length || 0,
      lastSTUNRefresh: Date.now()
    };
  }

  /**
   * Test STUN server connectivity
   */
  async testSTUNServer(server: STUNServer): Promise<boolean> {
    return new Promise((resolve) => {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: `stun:${server.host}:${server.port}` }] });
      
      const timeout = setTimeout(() => {
        pc.close();
        resolve(false);
      }, P2P_CONFIG.stunTimeout);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          clearTimeout(timeout);
          pc.close();
          resolve(true);
        }
      };

      pc.createDataChannel('test');
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timeout);
          pc.close();
          resolve(false);
        });
    });
  }

  /**
   * Get optimal STUN servers based on connectivity test
   */
  async getOptimalSTUNServers(count: number = 5): Promise<STUNServer[]> {
    const servers = getSTUNServers(FREE_STUN_SERVERS.length);
    const results: { server: STUNServer; success: boolean; time: number }[] = [];

    for (const server of servers) {
      const start = Date.now();
      const success = await this.testSTUNServer(server);
      results.push({
        server,
        success,
        time: Date.now() - start
      });
    }

    return results
      .filter(r => r.success)
      .sort((a, b) => a.time - b.time)
      .slice(0, count)
      .map(r => r.server);
  }

  /**
   * Cleanup and destroy P2P manager
   */
  destroy(): void {
    if (this.stunRefreshInterval) {
      clearInterval(this.stunRefreshInterval);
    }

    this.peerConnections.forEach((_, peerId) => {
      this.cleanupPeerConnection(peerId);
    });

    this.messageHandlers.clear();
  }
}

// Export singleton instance
export const p2pManager = new P2PManager();

export default P2PManager;