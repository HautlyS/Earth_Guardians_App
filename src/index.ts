/**
 * Earth Guardians App - Main Entry Point
 * Decentralized collaborative platform with P2P, Quantum Encryption, and Supabase
 */

import { supabase } from './core/supabase';
import { enhancedP2PManager } from './p2p/enhanced-p2p-manager';
import { teamService } from './team/team-service';
import { projectService } from './project/project-service';
import { messagingService } from './messaging/messaging-service';
import { storageService } from './storage/storage-service';
import { 
  encryptData, 
  decryptData, 
  generateQuantumKeyMaterial,
  calculateChecksum 
} from './encryption/quantum-encryption';

// ============================================================
// APP INITIALIZATION
// ============================================================

export interface EarthGuardiansApp {
  // Core
  supabase: typeof supabase;
  p2p: typeof enhancedP2PManager;
  
  // Services
  teams: typeof teamService;
  projects: typeof projectService;
  messaging: typeof messagingService;
  storage: typeof storageService;
  
  // Encryption
  encryption: {
    encrypt: typeof encryptData;
    decrypt: typeof decryptData;
    generateKey: typeof generateQuantumKeyMaterial;
    checksum: typeof calculateChecksum;
  };
  
  // Auth
  auth: {
    signIn: (email: string, password: string) => Promise<any>;
    signUp: (email: string, password: string) => Promise<any>;
    signOut: () => Promise<void>;
    getUser: () => any;
    onAuthChange: (callback: (user: any) => void) => void;
  };
}

class EarthGuardiansApp {
  constructor() {
    this.initializeP2P();
    this.setupRealtimeListeners();
  }

  private async initializeP2P(): Promise<void> {
    console.log('[Earth Guardians] Initializing P2P network...');
    
    // Get peer stats
    const stats = enhancedP2PManager.getPeerStats();
    console.log('[Earth Guardians] Local peer ID:', stats.localPeerId);
    console.log('[Earth Guardians] STUN servers:', stats.stunServersCount);
    
    // Setup P2P event handlers
    enhancedP2PManager.on('connected', (data: any) => {
      console.log('[Earth Guardians] Peer connected:', data.peerId);
      this.onPeerConnected(data.peerId);
    });

    enhancedP2PManager.on('disconnected', (data: any) => {
      console.log('[Earth Guardians] Peer disconnected:', data.peerId);
      this.onPeerDisconnected(data.peerId);
    });

    enhancedP2PManager.on('data', (data: any) => {
      this.onPeerData(data.peerId, data.data);
    });

    enhancedP2PManager.on('transfer', (data: any) => {
      this.onTransferProgress(data);
    });

    enhancedP2PManager.on('error', (data: any) => {
      console.error('[Earth Guardians] P2P error:', data);
    });
  }

  private setupRealtimeListeners(): void {
    // Listen for user presence
    supabase.channel('presence')
      .on('presence', { event: 'sync' }, () => {
        const state = supabase.channel('presence').presenceState();
        console.log('[Earth Guardians] Presence state:', state);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await supabase.channel('presence').track({
            user_id: supabase.auth.user()?.id,
            online_at: new Date().toISOString(),
          });
        }
      });
  }

  private onPeerConnected(peerId: string): void {
    // Notify services that peer is connected
    console.log('[Earth Guardians] P2P connection established with:', peerId);
  }

  private onPeerDisconnected(peerId: string): void {
    console.log('[Earth Guardians] P2P connection lost with:', peerId);
  }

  private onPeerData(peerId: string, data: unknown): void {
    console.log('[Earth Guardians] Data received from', peerId, ':', data);
  }

  private onTransferProgress(data: any): void {
    console.log('[Earth Guardians] Transfer progress:', data);
  }

  // ============================================================
  // AUTH METHODS
  // ============================================================

  async signIn(email: string, password: string): Promise<any> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  }

  async signUp(email: string, password: string): Promise<any> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  }

  async signOut(): Promise<void> {
    enhancedP2PManager.destroy();
    await supabase.auth.signOut();
  }

  getUser(): any {
    return supabase.auth.user();
  }

  onAuthChange(callback: (user: any) => void): void {
    supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null);
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  /**
   * Get app statistics
   */
  getStats(): {
    peerId: string;
    connectedPeers: number;
    relayNodes: number;
    stunServers: number;
    isP2PConnected: boolean;
  } {
    const p2pStats = enhancedP2PManager.getPeerStats();
    return {
      peerId: p2pStats.localPeerId,
      connectedPeers: p2pStats.connectedPeers,
      relayNodes: p2pStats.relayNodesCount,
      stunServers: p2pStats.stunServersCount,
      isP2PConnected: p2pStats.connectedPeers > 0,
    };
  }

  /**
   * Connect to a peer
   */
  async connectToPeer(peerId: string): Promise<void> {
    await enhancedP2PManager.createOffer(peerId);
  }

  /**
   * Disconnect from a peer
   */
  disconnectFromPeer(peerId: string): void {
    enhancedP2PManager.cleanupPeer(peerId);
  }

  /**
   * Send encrypted message to peer
   */
  async sendEncryptedMessage(peerId: string, data: unknown): Promise<boolean> {
    const keyMaterial = await generateQuantumKeyMaterial();
    return enhancedP2PManager.sendEncrypted(peerId, data, keyMaterial);
  }

  /**
   * Share file with peer
   */
  async shareFileWithPeer(peerId: string, file: File, options?: {
    compress?: boolean;
    encrypt?: boolean;
  }): Promise<void> {
    await enhancedP2PManager.sendFile(peerId, file, options);
  }

  /**
   * Get connected peers
   */
  getConnectedPeers(): string[] {
    return enhancedP2PManager.getConnectedPeers();
  }

  /**
   * Check if connected to peer
   */
  isPeerConnected(peerId: string): boolean {
    return enhancedP2PManager.isConnected(peerId);
  }

  /**
   * Destroy app and cleanup
   */
  destroy(): void {
    enhancedP2PManager.destroy();
    supabase.removeAllChannels();
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const earthGuardiansApp = new EarthGuardiansApp();

export default EarthGuardiansApp;

// Re-export everything for convenience
export {
  supabase,
  enhancedP2PManager,
  teamService,
  projectService,
  messagingService,
  storageService,
  encryptData,
  decryptData,
  generateQuantumKeyMaterial,
  calculateChecksum,
};