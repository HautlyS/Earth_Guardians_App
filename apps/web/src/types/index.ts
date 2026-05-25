/**
 * Type Definitions for Earth Guardians Platform
 */

// P2P Types
export interface P2PConfig {
  stunServers: STUNServer[]
  relayEnabled: boolean
  maxConnections: number
  chunkSize: number
}

export interface STUNServer {
  host: string
  port: number
  description?: string
}

export interface PeerConnection {
  peerId: string
  connection: RTCPeerConnection
  dataChannel?: RTCDataChannel
  metadata: Record<string, unknown>
}

export interface P2PStats {
  peerId: string
  connectedPeers: number
  stunServers: number
}

// WASM Types
export interface WasmModule {
  Compressor: new () => Compressor
  Hasher: new () => Hasher
  P2PUtils: new () => P2PUtils
}

export interface Compressor {
  compress(data: Uint8Array): Uint8Array
  decompress(data: Uint8Array): Uint8Array
}

export interface Hasher {
  update(data: Uint8Array): void
  finish(): string
}

export interface P2PUtils {
  generate_peer_id(): string
}

// Theme Types
export type Theme = 'light' | 'dark' | 'high-contrast'

export interface ThemeConfig {
  primary: string
  secondary: string
  accent: string
  background: string
  foreground: string
  border: string
  text: string
  textMuted: string
}

// User Types
export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

export interface UserPreferences {
  theme: Theme
  language: string
  notifications: NotificationSettings
  privacy: PrivacySettings
}

export interface NotificationSettings {
  email: boolean
  push: boolean
  inApp: boolean
}

export interface PrivacySettings {
  showOnline: boolean
  allowP2P: boolean
  shareLocation: boolean
}

// Project Types
export interface Project {
  id: string
  name: string
  description: string
  owner: string
  members: string[]
  createdAt: Date
  updatedAt: Date
  status: ProjectStatus
  visibility: Visibility
}

export type ProjectStatus = 'active' | 'archived' | 'draft'
export type Visibility = 'public' | 'private' | 'team'

// Message Types
export interface Message {
  id: string
  senderId: string
  receiverId: string
  content: string
  type: MessageType
  timestamp: Date
  read: boolean
}

export type MessageType = 'text' | 'file' | 'system' | 'reaction'

// File Transfer Types
export interface FileTransfer {
  id: string
  fileName: string
  fileSize: number
  totalChunks: number
  progress: number
  status: TransferStatus
}

export type TransferStatus = 'pending' | 'transferring' | 'completed' | 'failed'

// API Response Types
export interface ApiResponse<T> {
  data: T | null
  error: ApiError | null
  status: number
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// Component Types
export interface ComponentProps {
  class?: string
  style?: Record<string, string>
  id?: string
}

export interface CardProps extends ComponentProps {
  title: string
  subtitle?: string
  variant?: 'default' | 'outlined' | 'elevated'
}

export interface ButtonProps extends ComponentProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
}

// Store Types
export interface RootState {
  user: UserState
  p2p: P2PState
  settings: SettingsState
}

export interface UserState {
  currentUser: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface P2PState {
  peerId: string
  connectedPeers: string[]
  connectionStatus: ConnectionStatus
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface SettingsState {
  theme: Theme
  language: string
  notifications: NotificationSettings
}

// Event Types
export interface P2PEvent {
  type: string
  peerId: string
  data: unknown
  timestamp: Date
}

export interface WebSocketEvent {
  type: string
  payload: unknown
}

// Environment Types
export interface EnvironmentVariables {
  VITE_SUPABASE_URL: string
  VITE_SUPABASE_ANON_KEY: string
  VITE_API_URL: string
  VITE_STUN_SERVERS: string
  VITE_WASM_CHUNK_SIZE: string
}

// Utility Types
export type AsyncFunction<T> = () => Promise<T>
export type VoidFunction = () => void

export interface IDisposable {
  dispose(): void
}

export interface Comparable<T> {
  equals(other: T): boolean
}

// Helper Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type PromiseOrValue<T> = T | Promise<T>

// Re-export commonly used types
export {
  RTCPeerConnection,
  RTCSessionDescriptionInit,
  RTCIceCandidateInit,
  RTCDataChannel,
  RTCDataChannelState
} from 'webrtc'