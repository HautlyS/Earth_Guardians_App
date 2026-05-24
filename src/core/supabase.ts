/**
 * Earth Guardians App - Supabase Client Configuration
 * Connects to Supabase for auth, database, and storage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { User, Team, Project, Task, Conversation, Message, Notification } from '../types';

// Environment variables (set these in your .env file)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_KEY || '';

// ============================================================
// CLIENT INSTANCES
// ============================================================

// Public client for browser usage
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Admin client for server-side operations (never expose to browser)
let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient && SUPABASE_SERVICE_KEY) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient || supabase;
}

// ============================================================
// DATABASE TYPES (for Supabase generated types)
// ============================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          role: 'owner' | 'admin' | 'moderator' | 'staff' | 'member' | 'guest';
          status: string;
          last_seen_at: string | null;
          metadata: Record<string, unknown>;
          settings: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      teams: {
        Row: Team;
        Insert: Omit<Team, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Team>;
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: string;
          nickname: string | null;
          joined_at: string;
          invited_by: string | null;
          metadata: Record<string, unknown>;
        };
        Insert: Omit<Database['public']['Tables']['team_members']['Row'], 'id' | 'joined_at'>;
        Update: Partial<Database['public']['Tables']['team_members']['Insert']>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Project>;
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: string;
          can_edit: boolean;
          can_delete: boolean;
          joined_at: string;
        };
        Insert: Omit<Database['public']['Tables']['project_members']['Row'], 'id' | 'joined_at'>;
        Update: Partial<Database['public']['Tables']['project_members']['Insert']>;
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Task>;
      };
      task_comments: {
        Row: {
          id: string;
          task_id: string;
          parent_id: string | null;
          user_id: string;
          content: string;
          is_edited: boolean;
          reactions: Record<string, string[]>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['task_comments']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['task_comments']['Insert']>;
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Conversation>;
      };
      conversation_participants: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: string;
          joined_at: string;
          last_read_at: string;
          notifications_enabled: boolean;
        };
        Insert: Omit<Database['public']['Tables']['conversation_participants']['Row'], 'id' | 'joined_at' | 'last_read_at'>;
        Update: Partial<Database['public']['Tables']['conversation_participants']['Insert']>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Message>;
      };
      files: {
        Row: {
          id: string;
          name: string;
          mime_type: string | null;
          size: number;
          storage_type: string;
          storage_path: string;
          p2p_node_id: string | null;
          quantum_encrypted: boolean;
          encryption_key_id: string | null;
          team_id: string | null;
          project_id: string | null;
          uploaded_by: string;
          metadata: Record<string, unknown>;
          checksum: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['files']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['files']['Insert']>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at'>;
        Update: Partial<Notification>;
      };
    };
    Functions: Record<string, unknown>;
    Enums: Record<string, string[]>;
  };
}

// ============================================================
// AUTH HELPERS
// ============================================================

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

let authState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

export function getAuthState(): AuthState {
  return authState;
}

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    authState = {
      user: session.user as unknown as User,
      isAuthenticated: true,
      isLoading: false,
    };
  } else {
    authState = {
      user: null,
      isAuthenticated: false,
      isLoading: false,
    };
  }
});

// ============================================================
// REALTIME SUBSCRIPTIONS
// ============================================================

export interface RealtimeChannel {
  subscribe(callback: (payload: unknown) => void): () => void;
  unsubscribe(): void;
}

// Subscribe to database changes
export function subscribeToTable<T>(
  table: string,
  callback: (payload: { type: string; new: T; old: T | null }) => void
): () => void {
  const channel = supabase.channel(`${table}-changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
      },
      (payload) => {
        callback(payload as { type: string; new: T; old: T | null });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Subscribe to messages in a conversation
export function subscribeToMessages(
  conversationId: string,
  callback: (message: Message) => void
): () => void {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload.new as Message);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Subscribe to task changes
export function subscribeToTasks(
  projectId: string,
  callback: (task: Task, eventType: string) => void
): () => void {
  const channel = supabase
    .channel(`tasks:${projectId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        callback(
          payload.new as Task,
          payload.eventType as string
        );
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Subscribe to notifications
export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as Notification);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================
// STORAGE HELPERS
// ============================================================

export const storage = supabase.storage;

// Upload file to Supabase storage
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: {
    contentType?: string;
    cacheControl?: string;
  }
): Promise<{ data: { path: string; url: string } | null; error: Error | null }> {
  const { data, error } = await storage.upload(path, file, {
    contentType: options?.contentType || 'application/octet-stream',
    cacheControl: options?.cacheControl || '3600',
    upsert: false,
  });

  if (error) {
    return { data: null, error };
  }

  const publicUrl = storage.getPublicUrl(bucket, data.key);
  return {
    data: { path: data.key, url: publicUrl.publicURL || '' },
    error: null,
  };
}

// Download file from Supabase storage
export async function downloadFile(
  bucket: string,
  path: string
): Promise<{ data: Blob | null; error: Error | null }> {
  const { data, error } = await storage.download(path);
  return { data, error };
}

// Delete file from Supabase storage
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ error: Error | null }> {
  const { error } = await storage.remove([path]);
  return { error };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

// Generate UUID
export function generateUUID(): string {
  return crypto.randomUUID();
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Export types for convenience
export type { User, Team, Project, Task, Conversation, Message, Notification } from '../types';