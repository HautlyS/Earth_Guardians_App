/**
 * Earth Guardians - P2P WebRTC Manager
 */

import { FREE_STUN_SERVERS, STUNServer } from './stun-servers';

export interface P2PConfig {
  stunServers: STUNServer[];
  relayEnabled: boolean;
  maxConnections: number;
  chunkSize: number;
}

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  metadata: Record<string, unknown>;
}

export class P2PManager {
  private connections = new Map<string, PeerConnection>();
  private localPeerId: string;
  private rtcConfig: RTCConfiguration;
  private messageHandlers = new Map<string, ((data: unknown) => void)[]>();

  constructor(private config: P2PConfig = { stunServers: FREE_STUN_SERVERS, relayEnabled: true, maxConnections: 50, chunkSize: 65536 }) {
    this.localPeerId = this.generatePeerId();
    this.rtcConfig = this.buildRTCConfig();
  }

  private generatePeerId(): string {
    return `peer_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private buildRTCConfig(): RTCConfiguration {
    const iceServers: RTCIceServer[] = this.config.stunServers.map(server => ({
      urls: [`stun:${server.host}:${server.port}`, `stun:${server.host}:${server.port}?transport=udp`],
      username: '',
      credential: ''
    }));
    iceServers.push({ urls: 'stun:stun.l.google.com:19302' });
    return { iceServers, iceCandidatePoolSize: 10, bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' };
  }

  createConnection(peerId: string): RTCPeerConnection {
    const existing = this.connections.get(peerId);
    if (existing) return existing.connection;

    const connection = new RTCPeerConnection(this.rtcConfig);
    connection.onicecandidate = (event) => {
      if (event.candidate) this.broadcastSignal(peerId, 'ice-candidate', event.candidate.toJSON());
    };
    connection.onconnectionstatechange = () => console.log(`Connection with ${peerId}: ${connection.connectionState}`);
    connection.ondatachannel = (event) => this.setupDataChannel(peerId, event.channel);

    const dataChannel = connection.createDataChannel('p2p', { ordered: true });
    this.setupDataChannel(peerId, dataChannel);

    this.connections.set(peerId, { peerId, connection, dataChannel, metadata: { createdAt: Date.now() } });
    return connection;
  }

  private setupDataChannel(peerId: string, channel: RTCDataChannel): void {
    channel.onopen = () => { console.log(`Data channel open with ${peerId}`); this.emit('connected', { peerId }); };
    channel.onclose = () => { console.log(`Data channel closed with ${peerId}`); this.emit('disconnected', { peerId }); };
    channel.onmessage = (event) => this.handleMessage(peerId, event.data);
    const peer = this.connections.get(peerId);
    if (peer) peer.dataChannel = channel;
  }

  private handleMessage(peerId: string, data: string | ArrayBuffer): void {
    try {
      const message = JSON.parse(data as string);
      this.emit(message.type, { peerId, message });
    } catch { this.emit('data', { peerId, data }); }
  }

  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const pc = this.createConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.broadcastSignal(peerId, 'offer', offer);
    return offer;
  }

  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const pc = this.createConnection(peerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.broadcastSignal(peerId, 'answer', answer);
    return answer;
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.connections.get(peerId);
    if (peer) await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.connections.get(peerId);
    if (peer) await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private broadcastSignal(peerId: string, type: string, data: unknown): void {
    console.log(`Signal ${type} for ${peerId}:`, data);
  }

  send(peerId: string, data: unknown): boolean {
    const peer = this.connections.get(peerId);
    if (peer?.dataChannel?.readyState === 'open') {
      peer.dataChannel.send(JSON.stringify({ type: 'data', sender: this.localPeerId, timestamp: Date.now(), payload: data }));
      return true;
    }
    return false;
  }

  async sendFile(peerId: string, file: File): Promise<void> {
    const peer = this.connections.get(peerId);
    if (!peer?.dataChannel || peer.dataChannel.readyState !== 'open') throw new Error('No connection to peer');
    const buffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(buffer.byteLength / this.config.chunkSize);
    this.send(peerId, { type: 'file-start', fileName: file.name, fileSize: file.size, totalChunks });
    for (let i = 0; i < totalChunks; i++) {
      peer.dataChannel.send(buffer.slice(i * this.config.chunkSize, (i + 1) * this.config.chunkSize));
      this.emit('transfer-progress', { peerId, fileName: file.name, progress: ((i + 1) / totalChunks) * 100 });
    }
    this.send(peerId, { type: 'file-complete', fileName: file.name });
  }

  on(event: string, handler: (data: unknown) => void): void {
    if (!this.messageHandlers.has(event)) this.messageHandlers.set(event, []);
    this.messageHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: (data: unknown) => void): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) { const index = handlers.indexOf(handler); if (index > -1) handlers.splice(index, 1); }
  }

  private emit(event: string, data: unknown): void { this.messageHandlers.get(event)?.forEach(h => h(data)); }

  getStats(): { peerId: string; connectedPeers: number; stunServers: number } {
    return { peerId: this.localPeerId, connectedPeers: this.connections.size, stunServers: this.config.stunServers.length };
  }

  getConnectedPeers(): string[] {
    return Array.from(this.connections.keys()).filter(id => this.connections.get(id)?.dataChannel?.readyState === 'open');
  }

  closeConnection(peerId: string): void {
    const peer = this.connections.get(peerId);
    if (peer) { peer.dataChannel?.close(); peer.connection.close(); this.connections.delete(peerId); }
  }

  destroy(): void { this.connections.forEach((_, id) => this.closeConnection(id)); this.messageHandlers.clear(); }
}

export const p2pManager = new P2PManager();
export default P2PManager;
