/**
 * Earth Guardians App - Secure Storage Service
 * Handles file uploads, P2P sharing, and quantum encryption
 */

import { supabase, uploadFile, downloadFile, deleteFile } from '../core/supabase';
import { enhancedP2PManager } from '../p2p/enhanced-p2p-manager';
import { 
  encryptFile, 
  decryptFile, 
  generateQuantumKeyMaterial, 
  QuantumKeyMaterial, 
  calculateChecksum,
  storeKeyLocally 
} from '../encryption/quantum-encryption';
import type { File, StorageType } from '../types';

// ============================================================
// STORAGE SERVICE
// ============================================================

export class StorageService {
  private activeUploads: Map<string, { progress: number; abort: () => void }> = new Map();

  /**
   * Upload file to Supabase storage
   */
  async uploadFile(
    file: File,
    bucket: string,
    path: string,
    options?: {
      teamId?: string;
      projectId?: string;
      encrypt?: boolean;
      compress?: boolean;
      onProgress?: (progress: number) => void;
    }
  ): Promise<File> {
    let fileToUpload = file;
    
    // Encrypt if requested
    if (options?.encrypt) {
      const keyMaterial = await generateQuantumKeyMaterial();
      const encrypted = await encryptFile(file, keyMaterial);
      
      // Store key locally
      await storeKeyLocally(keyMaterial, 'user-password'); // TODO: Use proper password
      
      // Create encrypted file
      const encryptedBlob = new Blob([new TextEncoder().encode(JSON.stringify(encrypted))], {
        type: 'application/json',
      });
      fileToUpload = new File([encryptedBlob], `${file.name}.encrypted`);
      
      // Register key
      enhancedP2PManager.registerEncryptionKey(keyMaterial.keyId, keyMaterial.key);
    }

    // Simulate progress for large files
    if (options?.onProgress) {
      const interval = setInterval(() => {
        const current = this.activeUploads.get(file.name);
        if (current) {
          options.onProgress!(Math.min(current.progress + 10, 90));
        }
      }, 500);
      
      this.activeUploads.set(file.name, {
        progress: 0,
        abort: () => clearInterval(interval),
      });
    }

    // Upload to Supabase
    const { data, error } = await uploadFile(bucket, path, fileToUpload, {
      contentType: fileToUpload.type,
    });

    if (options?.onProgress) {
      const current = this.activeUploads.get(file.name);
      if (current) current.abort();
      options.onProgress(100);
    }

    if (error) throw error;

    // Register in database
    const userId = supabase.auth.user()?.id;
    const checksum = await calculateChecksum(file);

    const { data: dbFile, error: dbError } = await supabase
      .from('files')
      .insert({
        name: file.name,
        mime_type: file.type,
        size: file.size,
        storage_type: 'supabase',
        storage_path: data.path,
        quantum_encrypted: options?.encrypt || false,
        team_id: options?.teamId,
        project_id: options?.projectId,
        uploaded_by: userId,
        checksum,
      })
      .select()
      .single();

    if (dbError) throw dbError;
    return { ...dbFile, ...file } as File;
  }

  /**
   * Upload file via P2P network
   */
  async uploadP2PFile(
    file: File,
    targetPeers: string[],
    options?: {
      teamId?: string;
      projectId?: string;
      encrypt?: boolean;
      compress?: boolean;
      onProgress?: (peer: string, progress: number) => void;
    }
  ): Promise<{ transferId: string; fileId: string }> {
    const transferId = `p2p_transfer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    let keyMaterial: QuantumKeyMaterial | undefined;
    
    // Encrypt if requested
    if (options?.encrypt) {
      keyMaterial = await generateQuantumKeyMaterial();
    }

    // Register transfer
    const { data: dbFile } = await supabase
      .from('files')
      .insert({
        name: file.name,
        mime_type: file.type,
        size: file.size,
        storage_type: 'p2p',
        p2p_node_id: enhancedP2PManager.getPeerStats().localPeerId,
        quantum_encrypted: options?.encrypt || false,
        team_id: options?.teamId,
        project_id: options?.projectId,
        uploaded_by: supabase.auth.user()?.id,
      })
      .select()
      .single();

    if (!dbFile) throw new Error('Failed to register P2P file');

    // Send to peers
    for (const peerId of targetPeers) {
      if (options?.onProgress) {
        enhancedP2PManager.on('transfer', (data: any) => {
          if (data.peerId === peerId) {
            options.onProgress!(peerId, data.progress);
          }
        });
      }

      await enhancedP2PManager.sendFile(peerId, file, {
        encrypt: options?.encrypt,
        compress: options?.compress,
        keyMaterial,
      });
    }

    // Register P2P transfer in database
    await supabase.from('p2p_transfers').insert({
      transfer_id: transferId,
      file_id: dbFile.id,
      sender_peer_id: enhancedP2PManager.getPeerStats().localPeerId,
      receiver_peer_id: targetPeers[0],
      file_name: file.name,
      file_size: file.size,
      total_chunks: Math.ceil(file.size / 65536),
      encrypted: options?.encrypt || false,
      encryption_key_id: keyMaterial?.keyId,
      status: 'in_progress',
    });

    return { transferId, fileId: dbFile.id };
  }

  /**
   * Download file from Supabase storage
   */
  async downloadSupabaseFile(fileId: string, bucket: string): Promise<File> {
    const { data: fileRecord, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error || !fileRecord) throw new Error('File not found');

    const { data: blob, error: downloadError } = await downloadFile(bucket, fileRecord.storage_path);
    
    if (downloadError) throw downloadError;
    if (!blob) throw new Error('Failed to download file');

    // Decrypt if encrypted
    if (fileRecord.quantum_encrypted) {
      // Would need to retrieve key from storage
      const keyMaterial = await generateQuantumKeyMaterial(); // TODO: Retrieve actual key
      const encryptedJson = JSON.parse(await blob.text());
      return decryptFile(encryptedJson, keyMaterial.key);
    }

    return new File([blob], fileRecord.name, { type: fileRecord.mime_type || 'application/octet-stream' });
  }

  /**
   * Get file metadata
   */
  async getFile(fileId: string): Promise<File | null> {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (error) return null;
    return data as unknown as File;
  }

  /**
   * Get files for a team or project
   */
  async getFiles(params: {
    teamId?: string;
    projectId?: string;
    storageType?: StorageType;
    limit?: number;
    offset?: number;
  }): Promise<{ files: File[]; total: number }> {
    let query = supabase
      .from('files')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.teamId) {
      query = query.eq('team_id', params.teamId);
    }
    if (params.projectId) {
      query = query.eq('project_id', params.projectId);
    }
    if (params.storageType) {
      query = query.eq('storage_type', params.storageType);
    }
    if (params.limit) {
      query = query.limit(params.limit);
    }
    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
    }

    const { data, count, error } = await query;
    
    if (error) throw error;
    return { files: (data || []) as unknown as File[], total: count || 0 };
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string, bucket: string): Promise<void> {
    // Get file record
    const { data: fileRecord, error } = await supabase
      .from('files')
      .select('storage_path, storage_type')
      .eq('id', fileId)
      .single();

    if (error) throw error;

    // Delete from storage
    if (fileRecord.storage_type === 'supabase') {
      const { error: storageError } = await deleteFile(bucket, fileRecord.storage_path);
      if (storageError) console.warn('Failed to delete from storage:', storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (dbError) throw dbError;
  }

  /**
   * Create a compressed archive
   */
  async createArchive(
    fileIds: string[],
    archiveName: string,
    options?: {
      compression?: 'lz4' | 'zstd' | 'gzip';
      level?: number;
      teamId?: string;
      encrypt?: boolean;
    }
  ): Promise<string> {
    // Get files
    const { data: files } = await supabase
      .from('files')
      .select('*')
      .in('id', fileIds);

    if (!files || files.length === 0) throw new Error('No files to archive');

    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

    // Create archive record
    const { data: archive, error } = await supabase
      .from('compressed_archives')
      .insert({
        archive_name: archiveName,
        compression_type: options?.compression || 'lz4',
        compression_level: options?.level || 3,
        original_size: totalSize,
        compressed_size: Math.floor(totalSize * 0.7), // Estimate
        ratio: 0.7,
        encrypted: options?.encrypt || false,
        storage_location: 'supabase',
        team_id: options?.teamId,
        created_by: supabase.auth.user()?.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Add archive contents
    const contents = files.map((f, i) => ({
      archive_id: archive.id,
      original_file_id: f.id,
      file_name: f.name,
      file_size: f.size,
      order_index: i,
    }));

    await supabase.from('archive_contents').insert(contents);

    return archive.id;
  }

  /**
   * Get P2P transfer status
   */
  async getTransferStatus(transferId: string): Promise<{
    status: string;
    progress: number;
    completedChunks: number;
    totalChunks: number;
    speedBps: number;
  }> {
    const { data, error } = await supabase
      .from('p2p_transfers')
      .select('*')
      .eq('transfer_id', transferId)
      .single();

    if (error || !data) throw new Error('Transfer not found');

    return {
      status: data.status,
      progress: data.total_chunks > 0 
        ? Math.floor((data.completed_chunks / data.total_chunks) * 100) 
        : 0,
      completedChunks: data.completed_chunks,
      totalChunks: data.total_chunks,
      speedBps: data.speed_bps || 0,
    };
  }

  /**
   * Cancel an upload
   */
  cancelUpload(fileName: string): void {
    const upload = this.activeUploads.get(fileName);
    if (upload) {
      upload.abort();
      this.activeUploads.delete(fileName);
    }
  }

  /**
   * Get storage quota
   */
  async getStorageQuota(teamId?: string): Promise<{
    used: number;
    limit: number;
    percentage: number;
  }> {
    let query = supabase
      .from('files')
      .select('size', { count: 'exact', head: true });

    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    const { count, error } = await query;
    
    if (error) throw error;

    const used = count || 0;
    const limit = 10 * 1024 * 1024 * 1024; // 10 GB default
    const percentage = Math.round((used / limit) * 100);

    return { used, limit, percentage };
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const storageService = new StorageService();
export default StorageService;