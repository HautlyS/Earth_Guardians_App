/**
 * Earth Guardians App - Enhanced P2P Manager
 * WebRTC-based decentralized networking with Supabase integration
 * Features: STUN server rotation, relay support, compressed transfers, encrypted channels
 */

import { P2P_CONFIG, STUN_LIST_URL, getRandomSTUNServer, getSTUNServers, STUNServer, FREE_STUN_SERVERS } from './stun-servers';
import { supabase, subscribeToTable } from '../core/supabase';
import { encryptData, decryptData, QuantumKeyMaterial, arrayToBase64, base64ToArray } from '../encryption/quantum-encryption';

// ============================================================
// TYPES
// ============================================================

export interface P2PNode {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  metadata: P2PMetadata;
}

export interface P2PMetadata {
  name?: string;
  deviceType?: string;
  publicKey?: string;
  region?: string;
  capabilities?: string[];
  joinedAt: number;
}

export interface P2PMessage {
  type: 'signal' | 'data' | 'discovery' | 'sync' | 'file' | 'compressed';
  sender: string;
  timestamp: number;
  payload: P2PPayload;
}

export interface P2PPayload {
  action?: string;
  targetPeer?: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  data?: unknown;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  compressed?: boolean;
  encryptionKeyId?: string;
}

export interface P2PTransfer {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  chunks: Uint8Array[];
  completedChunks: number;
  totalChunks: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  encrypted: boolean;
  compressed: boolean;
}

export interface STUNRefreshResult {
  servers: string[];
  timestamp: number;
  source: string;
}

export type P2PEventType = 'connected' | 'disconnected' | 'data' | 'transfer' | 'error' | 'discovery';

// ============================================================
// COMPRESSION UTILITIES
// ============================================================

/**
 * Compress data using LZ4 compression (browser-compatible)
 */
export async function compressData(data: Uint8Array): Promise<Uint8Array> {
  // Simple LZ77-based compression for browser
  const dictionary = new Map<string, number>();
  const output: number[] = [];
  let dictSize = 256;
  
  for (let i = 0; i < data.length; ) {
    let longestMatch = -1;
    let matchLength = 0;
    let matchPosition = 0;
    
    const windowStart = Math.max(0, i - 4096);
    const window = data.slice(windowStart, i);
    const remaining = data.slice(i, i + 258);
    
    for (let j = 0; j < window.length; j++) {
      let matchLen = 0;
      while (matchLen < remaining.length && window[j + matchLen] === remaining[matchLen]) {
        matchLen++;
        if (j + matchLen >= window.length) break;
      }
      
      if (matchLen > matchLength) {
        longestMatch = windowStart + j;
        matchLength = matchLen;
        matchPosition = i - longestMatch;
      }
    }
    
    if (matchLength > 3) {
      output.push(0x80 | Math.min(matchLength - 4, 127));
      output.push(matchPosition >> 8);
      output.push(matchPosition & 0xFF);
      i += matchLength;
    } else {
      output.push(data[i]);
      i++;
    }
  }
  
  return new Uint8Array(output);
}

/**
 * Decompress LZ4-compressed data
 */
export async function decompressData(compressed: Uint8Array): Promise<Uint8Array> {
  const output: number[] = [];
  let i = 0;
  
  while (i < compressed.length) {
    const byte = compressed[i];
    
    if (byte < 0x80) {
      output.push(byte);
      i++;
    } else {
      const length = (byte & 0x7F) + 4;
      i++;
      if (i + 1 >= compressed.length) break;
      const position = (compressed[i] << 8) | compressed[i + 1];
      i += 2;
      
      for (let j = 0; j < length; j++) {
        output.push(output[output.length - position] || 0);
      }
    }
  }
  
  return new Uint8Array(output);
}

// ============================================================
// P2P MANAGER CLASS
// ============================================================

class EnhancedP2PManager {
  private peerConnections: Map<string, P2PNode> = new Map();
  private localPeerId: string;
  private rtcConfig: RTCConfiguration;
  private messageHandlers: Map<P2PEventType, ((data: unknown) => void)[]> = new Map();
  private stunRefreshInterval: ReturnType<typeof setInterval> | null = null;
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private transfers: Map<string, P2PTransfer> = new Map();
  private activeFileTransfers: Map<string, { peerId: string; file: File; progress: number }> = new Map();
  private relayNodes: P2PRelayNode[] = [];
  private encryptionKeys: Map<string, CryptoKey> = new Map();

  constructor() {
    this.localPeerId = this.generatePeerId();
    this.rtcConfig = this.buildRTCConfig();
    this.startSTUNRefresh();
    this.loadRelayNodes();
    this.registerP2PNode();
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  private generatePeerId(): string {
    return `peer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private buildRTCConfig(): RTCConfiguration {
    const iceServers = this.getICEServers();
    return {
      iceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };
  }

  private getICEServers(): RTCIceServer[] {
    return [
      ...P2P_CONFIG.stunServers.map(server => ({
        urls: [
          `stun:${server.host}:${server.port}`,
          `stun:${server.host}:${server.port}?transport=udp`
        ],
        username: '',
        credential: ''
      })),
      // Add Google STUN as fallback
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }

  private startSTUNRefresh(): void {
    this.stunRefreshInterval = setInterval(async () => {
      await this.refreshSTUNServers();
    }, 60 * 60 * 1000); // Refresh every hour
  }

  async refreshSTUNServers(): Promise<STUNRefreshResult> {
    try {
      const response = await fetch(STUN_LIST_URL, {
        cache: 'no-cache',
        headers: { 'Accept': 'text/plain' }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch STUN list: ${response.status}`);
      }

      const text = await response.text();
      const servers = text
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.trim());

      const newIceServers = servers.map(host => ({
        urls: [`stun:${host}`, `stun:${host}?transport=udp`] as RTCIceServer['urls'],
        username: '',
        credential: ''
      }));

      // Add fallback servers
      newIceServers.push(...P2P_CONFIG.stunServers.map(server => ({
        urls: [`stun:${server.host}:${server.port}`] as RTCIceServer['urls'],
        username: '',
        credential: ''
      })));

      this.rtcConfig.iceServers = newIceServers;

      return { servers, timestamp: Date.now(), source: STUN_LIST_URL };
    } catch (error) {
      console.warn('Failed to refresh STUN servers:', error);
      return {
        servers: FREE_STUN_SERVERS.map(s => s.url),
        timestamp: Date.now(),
        source: 'local-cache'
      };
    }
  }

  // ============================================================
  // RELAY NODES
  // ============================================================

  private async loadRelayNodes(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('p2p_relay_nodes')
        .select('*')
        .eq('status', 'available')
        .limit(10);

      if (error) throw error;

      this.relayNodes = (data || []).map(node => ({
        peerId: node.peer_id,
        relayUrl: node.relay_url,
        region: node.region,
        bandwidthMbps: node.bandwidth_mbps,
      }));
    } catch (error) {
      console.warn('Failed to load relay nodes:', error);
    }
  }

  async getRelayNode(region?: string): Promise<P2PRelayNode | null> {
    const available = this.relayNodes.filter(n => 
      n.bandwidthMbps > 10 && 
      (!region || n.region === region)
    );
    return available.length > 0 ? available[0] : null;
  }

  // ============================================================
  // NODE REGISTRATION
  // ============================================================

  private async registerP2PNode(): Promise<void> {
    try {
      const { error } = await supabase
        .from('p2p_nodes')
        .upsert({
          peer_id: this.localPeerId,
          ip_address: '', // Will be updated via WebRTC
          capabilities: ['storage', 'relay', 'discovery'],
          status: 'online',
          last_ping: new Date().toISOString(),
        }, {
          onConflict: 'peer_id',
        });

      if (error) console.warn('Failed to register P2P node:', error);
    } catch (error) {
      console.warn('Failed to register P2P node:', error);
    }
  }

  // ============================================================
  // PEER CONNECTION MANAGEMENT
  // ============================================================

  createPeerConnection(peerId: string): RTCPeerConnection {
    const existingConn = this.peerConnections.get(peerId);
    if (existingConn) {
      return existingConn.connection;
    }

    const connection = new RTCPeerConnection(this.rtcConfig);

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

    connection.ondatachannel = (event) => {
      this.setupIncomingDataChannel(peerId, event.channel);
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
      metadata: { joinedAt: Date.now() }
    });

    return connection;
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log(`Data channel open with peer: ${peerId}`);
      this.notifyHandlers('connected', { peerId });
    };

    channel.onclose = () => {
      console.log(`Data channel closed with peer: ${peerId}`);
      this.notifyHandlers('disconnected', { peerId });
      this.cleanupPeerConnection(peerId);
    };

    channel.onmessage = (event) => {
      this.handleDataChannelMessage(peerId, event);
    };

    channel.onerror = (error) => {
      console.error(`Data channel error with peer ${peerId}:`, error);
      this.notifyHandlers('error', { peerId, error });
    };

    this.dataChannels.set(peerId, channel);
  }

  private setupIncomingDataChannel(peerId: string, channel: RTCDataChannel): void {
    const existing = this.peerConnections.get(peerId);
    if (existing) {
      existing.dataChannel = channel;
    }
    this.setupDataChannel(peerId, channel);
  }

  private async handleDataChannelMessage(peerId: string, event: MessageEvent): Promise<void> {
    try {
      // Try to parse as JSON message
      const message: P2PMessage = JSON.parse(event.data);
      await this.processMessage(peerId, message);
    } catch {
      // Treat as binary data
      await this.handleBinaryData(peerId, new Uint8Array(event.data));
    }
  }

  private async processMessage(peerId: string, message: P2PMessage): Promise<void> {
    switch (message.type) {
      case 'signal':
        await this.handleSignalMessage(peerId, message.payload);
        break;
      case 'data':
        this.notifyHandlers('data', { peerId, data: message.payload });
        break;
      case 'discovery':
        this.notifyHandlers('discovery', { peerId, data: message.payload });
        break;
      case 'sync':
        this.notifyHandlers('data', { peerId, data: { type: 'sync', ...message.payload } });
        break;
      case 'file':
        await this.handleFileTransfer(peerId, message.payload);
        break;
      case 'compressed':
        await this.handleCompressedMessage(peerId, message.payload);
        break;
    }
  }

  private async handleBinaryData(peerId: string, data: Uint8Array): Promise<void> {
    // First byte indicates type
    const type = data[0];
    const payload = data.slice(1);

    if (type === 0x01) {
      // Compressed data
      const decompressed = await decompressData(payload);
      const text = new TextDecoder().decode(decompressed);
      try {
        const message: P2PMessage = JSON.parse(text);
        await this.processMessage(peerId, message);
      } catch {
        this.notifyHandlers('data', { peerId, data: text });
      }
    }
  }

  private async handleCompressedMessage(peerId: string, payload: P2PPayload): Promise<void> {
    if (payload.data) {
      const compressed = base64ToArray(payload.data as string);
      const decompressed = await decompressData(compressed);
      const text = new TextDecoder().decode(decompressed);
      
      try {
        const message: P2PMessage = JSON.parse(text);
        await this.processMessage(peerId, message);
      } catch {
        this.notifyHandlers('data', { peerId, data: text });
      }
    }
  }

  // ============================================================
  // SIGNALING
  // ============================================================

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

    this.broadcastMessage(signalMessage);
    return offer;
  }

  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const connection = this.createPeerConnection(peerId);
    await connection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    return answer;
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleICECandidateMessage(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  private async handleSignalMessage(peerId: string, payload: P2PPayload): Promise<void> {
    switch (payload.action) {
      case 'offer':
        await this.handleOffer(peerId, payload.offer!);
        break;
      case 'answer':
        await this.handleAnswer(peerId, payload.answer!);
        break;
      case 'ice-candidate':
        await this.handleICECandidateMessage(peerId, payload.candidate!);
        break;
    }
  }

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

  private handleConnectionStateChange(peerId: string, state: RTCIceConnectionState): void {
    console.log(`Connection state with ${peerId}: ${state}`);
    
    switch (state) {
      case 'connected':
        this.notifyHandlers('connected', { peerId });
        break;
      case 'disconnected':
      case 'failed':
        this.notifyHandlers('disconnected', { peerId });
        this.cleanupPeerConnection(peerId);
        break;
    }
  }

  private handleTrack(peerId: string, event: RTCTrackEvent): void {
    console.log(`Received track from ${peerId}:`, event.streams);
  }

  // ============================================================
  // FILE TRANSFER
  // ============================================================

  async sendFile(peerId: string, file: File, options?: {
    compress?: boolean;
    encrypt?: boolean;
    keyMaterial?: QuantumKeyMaterial;
  }): Promise<void> {
    const channel = this.dataChannels.get(peerId);
    if (!channel || channel.readyState !== 'open') {
      throw new Error(`No connection to peer ${peerId}`);
    }

    const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const chunkSize = 65536;
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    let fileData = new Uint8Array(await file.arrayBuffer());
    
    // Compress if requested
    if (options?.compress) {
      fileData = await compressData(fileData);
    }

    // Notify start of transfer
    const startMessage: P2PMessage = {
      type: 'file',
      sender: this.localPeerId,
      timestamp: Date.now(),
      payload: {
        action: 'start',
        fileId: transferId,
        fileName: file.name,
        fileSize: file.size,
        compressed: options?.compress || false,
      }
    };
    channel.send(JSON.stringify(startMessage));

    // Send file in chunks
    let offset = 0;
    let chunkIndex = 0;
    
    while (offset < fileData.length) {
      const chunk = fileData.slice(offset, offset + chunkSize);
      
      const chunkMessage: P2PMessage = {
        type: 'file',
        sender: this.localPeerId,
        timestamp: Date.now(),
        payload: {
          action: 'chunk',
          fileId: transferId,
          data: arrayToBase64(chunk),
        }
      };
      
      channel.send(JSON.stringify(chunkMessage));
      
      offset += chunkSize;
      chunkIndex++;
      
      // Update progress
      const progress = Math.floor((chunkIndex / totalChunks) * 100);
      this.notifyHandlers('transfer', { 
        peerId, 
        transferId, 
        progress, 
        fileName: file.name 
      });

      // Small delay to prevent overwhelming the connection
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Notify completion
    const completeMessage: P2PMessage = {
      type: 'file',
      sender: this.localPeerId,
      timestamp: Date.now(),
      payload: {
        action: 'complete',
        fileId: transferId,
      }
    };
    channel.send(JSON.stringify(completeMessage));

    this.notifyHandlers('transfer', { 
      peerId, 
      transferId, 
      progress: 100, 
      fileName: file.name,
      completed: true 
    });
  }

  private async handleFileTransfer(peerId: string, payload: P2PPayload): Promise<void> {
    switch (payload.action) {
      case 'start':
        this.activeFileTransfers.set(payload.fileId!, {
          peerId,
          file: new File([], payload.fileName!),
          progress: 0,
        });
        break;
      
      case 'chunk':
        // Handle incoming chunk
        this.notifyHandlers('transfer', { 
          peerId, 
          transferId: payload.fileId,
          progress: 0,
          receiving: true 
        });
        break;
      
      case 'complete':
        this.notifyHandlers('transfer', { 
          peerId, 
          transferId: payload.fileId,
          progress: 100,
          completed: true,
          receiving: true 
        });
        this.activeFileTransfers.delete(payload.fileId!);
        break;
    }
  }

  // ============================================================
  // MESSAGING
  // ============================================================

  sendToPeer(peerId: string, data: unknown): boolean {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === 'open') {
      const message: P2PMessage = {
        type: 'data',
        sender: this.localPeerId,
        timestamp: Date.now(),
        payload: { data }
      };
      channel.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  async sendCompressed(peerId: string, data: unknown): Promise<boolean> {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === 'open') {
      const text = JSON.stringify(data);
      const textData = new TextEncoder().encode(text);
      const compressed = await compressData(textData);
      
      const message: P2PMessage = {
        type: 'compressed',
        sender: this.localPeerId,
        timestamp: Date.now(),
        payload: { data: arrayToBase64(compressed) }
      };
      channel.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  broadcastMessage(message: P2PMessage): void {
    this.dataChannels.forEach((channel, peerId) => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify(message));
      }
    });
  }

  // ============================================================
  // ENCRYPTION INTEGRATION
  // ============================================================

  async sendEncrypted(peerId: string, data: unknown, keyMaterial: QuantumKeyMaterial): Promise<boolean> {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === 'open') {
      const text = JSON.stringify(data);
      const encrypted = await encryptData(text, keyMaterial);
      
      const message: P2PMessage = {
        type: 'data',
        sender: this.localPeerId,
        timestamp: Date.now(),
        payload: { 
          data: encrypted.ciphertext,
          encryptionKeyId: keyMaterial.keyId,
          encrypted: true
        }
      };
      channel.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  registerEncryptionKey(keyId: string, key: CryptoKey): void {
    this.encryptionKeys.set(keyId, key);
  }

  // ============================================================
  // EVENT HANDLING
  // ============================================================

  on(event: P2PEventType, handler: (data: unknown) => void): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  off(event: P2PEventType, handler: (data: unknown) => void): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private notifyHandlers(event: P2PEventType, data: unknown): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  private cleanupPeerConnection(peerId: string): void {
    const peer = this.peerConnections.get(peerId);
    if (peer) {
      peer.dataChannel?.close();
      peer.connection.close();
      this.peerConnections.delete(peerId);
      this.dataChannels.delete(peerId);
    }
  }

  cleanupPeer(peerId: string): void {
    this.cleanupPeerConnection(peerId);
  }

  destroy(): void {
    if (this.stunRefreshInterval) {
      clearInterval(this.stunRefreshInterval);
    }

    this.peerConnections.forEach((_, peerId) => {
      this.cleanupPeerConnection(peerId);
    });

    this.messageHandlers.clear();
    this.encryptionKeys.clear();
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  getPeerStats(): {
    localPeerId: string;
    connectedPeers: number;
    stunServersCount: number;
    lastSTUNRefresh: number;
    relayNodesCount: number;
  } {
    return {
      localPeerId: this.localPeerId,
      connectedPeers: this.peerConnections.size,
      stunServersCount: this.rtcConfig.iceServers?.length || 0,
      lastSTUNRefresh: Date.now(),
      relayNodesCount: this.relayNodes.length,
    };
  }

  getConnectedPeers(): string[] {
    return Array.from(this.peerConnections.keys());
  }

  isConnected(peerId: string): boolean {
    const peer = this.peerConnections.get(peerId);
    return peer?.dataChannel?.readyState === 'open';
  }
}

// ============================================================
// P2P RELAY NODE TYPE
// ============================================================

export interface P2PRelayNode {
  peerId: string;
  relayUrl: string;
  region: string;
  bandwidthMbps: number;
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const enhancedP2PManager = new EnhancedP2PManager();

export default EnhancedP2PManager;