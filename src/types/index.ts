/**
 * Earth Guardians App - Type Definitions
 * Complete type system for the collaborative platform
 */

// ============================================================
// USER & AUTH TYPES
// ============================================================

export type UserRole = 'owner' | 'admin' | 'moderator' | 'staff' | 'member' | 'guest';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeenAt: Date | null;
  metadata: Record<string, unknown>;
  settings: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  language: string;
  timezone: string;
  emailDigest: 'daily' | 'weekly' | 'never';
}

// ============================================================
// TEAM TYPES
// ============================================================

export type TeamStatus = 'active' | 'archived' | 'deleted';

export interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  status: TeamStatus;
  settings: TeamSettings;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamSettings {
  visibility: 'public' | 'private' | 'internal';
  allowMemberInvites: boolean;
  requireApproval: boolean;
  maxMembers: number;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  user?: User;
  role: UserRole;
  nickname: string | null;
  joinedAt: Date;
  invitedBy: string | null;
  metadata: Record<string, unknown>;
}

// ============================================================
// PROJECT & TASK TYPES
// ============================================================

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';

export interface Project {
  id: string;
  teamId: string;
  team?: Team;
  name: string;
  description: string | null;
  slug: string | null;
  status: ProjectStatus;
  priority: TaskPriority;
  color: string;
  icon: string | null;
  startDate: Date | null;
  endDate: Date | null;
  metadata: Record<string, unknown>;
  settings: ProjectSettings;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  allowGuestAccess: boolean;
  requireApproval: boolean;
  defaultTaskStatus: TaskStatus;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  user?: User;
  role: UserRole;
  canEdit: boolean;
  canDelete: boolean;
  joinedAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  project?: Project;
  parentId: string | null;
  parent?: Task;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignees: string[];
  assigneeUsers?: User[];
  labels: string[];
  dueDate: Date | null;
  estimatedHours: number | null;
  actualHours: number;
  progress: number;
  orderIndex: number;
  metadata: Record<string, unknown>;
  subtasks?: Task[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface TaskComment {
  id: string;
  taskId: string;
  parentId: string | null;
  userId: string;
  user?: User;
  content: string;
  isEdited: boolean;
  reactions: Record<string, string[]>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// MESSAGING TYPES
// ============================================================

export type MessageType = 'text' | 'file' | 'system' | 'reaction' | 'edited';
export type ConversationType = 'direct' | 'team' | 'project' | 'channel';

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  avatarUrl: string | null;
  participants: ConversationParticipant[];
  lastMessage?: Message;
  lastMessageAt: Date | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  user?: User;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: Date;
  lastReadAt: Date;
  notificationsEnabled: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: User;
  parentId: string | null;
  type: MessageType;
  content: string;
  contentEncrypted?: string;
  attachments: FileAttachment[];
  mentions: string[];
  reactions: Record<string, string[]>;
  isEdited: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

// ============================================================
// FILE STORAGE TYPES
// ============================================================

export type StorageType = 'supabase' | 'p2p' | 'quantum_encrypted' | 'hybrid';
export type FileStatus = 'pending' | 'uploading' | 'available' | 'p2p_shared' | 'failed';

export interface File {
  id: string;
  name: string;
  mimeType: string | null;
  size: number;
  storageType: StorageType;
  storagePath: string;
  p2pNodeId: string | null;
  quantumEncrypted: boolean;
  encryptionKeyId: string | null;
  teamId: string | null;
  projectId: string | null;
  uploadedBy: string;
  metadata: Record<string, unknown>;
  checksum: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  size: number;
  storagePath: string;
  checksum: string;
  uploadedBy: string;
  createdAt: Date;
}

export interface CompressedArchive {
  id: string;
  archiveName: string;
  compressionType: 'lz4' | 'zstd' | 'gzip' | 'lzma';
  compressionLevel: number;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  encrypted: boolean;
  storageLocation: 'local' | 'p2p' | 'supabase';
  storagePath: string;
  teamId: string | null;
  checksum: string;
  createdAt: Date;
}

// ============================================================
// P2P NETWORK TYPES
// ============================================================

export type P2PNodeStatus = 'online' | 'offline' | 'busy' | 'connecting';
export type P2PTransferStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused';

export interface P2PNode {
  id: string;
  peerId: string;
  publicKey: string | null;
  ipAddress: string | null;
  port: number | null;
  region: string;
  capabilities: P2PCapability[];
  status: P2PNodeStatus;
  lastPing: Date | null;
  createdAt: Date;
}

export type P2PCapability = 'storage' | 'relay' | 'discovery' | 'compute';

export interface P2PConnection {
  id: string;
  nodeAId: string;
  nodeBId: string;
  encryptedKey: string;
  establishedAt: Date;
  lastActivity: Date;
  metadata: Record<string, unknown>;
}

export interface P2PTransfer {
  id: string;
  transferId: string;
  fileId: string;
  senderPeerId: string;
  receiverPeerId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  completedChunks: number;
  encrypted: boolean;
  encryptionKeyId: string | null;
  status: P2PTransferStatus;
  speedBps: number;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface P2PMessage {
  type: 'signal' | 'data' | 'discovery' | 'sync' | 'file';
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
}

// ============================================================
// QUANTUM ENCRYPTION TYPES
// ============================================================

export type KeyType = 'symmetric' | 'asymmetric' | 'quantum_hybrid';
export type EncryptionAlgorithm = 'AES-256-GCM' | 'ChaCha20-Poly1305' | 'Kyber-768' | 'AES-256';

export interface QuantumKey {
  id: string;
  name: string;
  keyType: KeyType;
  algorithm: EncryptionAlgorithm;
  publicKey: string | null;
  encryptedPrivateKey: string | null;
  rotationEnabled: boolean;
  rotationPeriodDays: number;
  expiresAt: Date | null;
  lastRotatedAt: Date | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
}

export interface EncryptedBlob {
  id: string;
  dataType: 'file' | 'message' | 'credential' | 'config';
  encryptedContent: string;
  encryptionKeyId: string;
  algorithm: string;
  nonce: string;
  tag: string | null;
  teamId: string | null;
  userId: string | null;
  checksum: string;
  createdAt: Date;
}

export interface P2PSecureChannel {
  id: string;
  channelId: string;
  initiatorPeerId: string;
  responderPeerId: string;
  sessionKeyEncrypted: string;
  encryptionAlgorithm: string;
  establishedAt: Date;
  expiresAt: Date | null;
  lastActivity: Date;
  status: 'active' | 'expired' | 'revoked';
}

// ============================================================
// NOTIFICATION TYPES
// ============================================================

export type NotificationType = 
  | 'mention' 
  | 'task_assigned' 
  | 'task_completed'
  | 'team_invite' 
  | 'project_update' 
  | 'project_created'
  | 'message' 
  | 'system'
  | 'file_shared';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

// ============================================================
// REAL-TIME EVENT TYPES
// ============================================================

export type RealtimeEventType = 
  | 'INSERT' 
  | 'UPDATE' 
  | 'DELETE';

export interface RealtimePayload<T> {
  type: RealtimeEventType;
  table: string;
  record: T;
  oldRecord: T | null;
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface PresenceState {
  [key: string]: {
    userId: string;
    status: string;
    lastSeen: Date;
  }[];
}

// ============================================================
// UTILITY TYPES
// ============================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
}

export interface ModalConfig {
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
}