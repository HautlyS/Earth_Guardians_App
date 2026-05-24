/**
 * Earth Guardians App - Messaging Service
 * Handles conversations, messages, and real-time chat
 */

import { supabase, subscribeToMessages } from '../core/supabase';
import type { Conversation, ConversationParticipant, Message, ConversationType } from '../types';

// ============================================================
// MESSAGING SERVICE
// ============================================================

export class MessagingService {
  /**
   * Get all conversations for the current user
   */
  async getConversations(): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        conversation_participants!inner(user_id)
      `)
      .eq('conversation_participants.user_id', supabase.auth.user()?.id || '')
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw error;

    // Fetch last message for each conversation
    const conversations = await Promise.all(
      (data || []).map(async (conv) => {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          ...conv,
          lastMessage: lastMsg,
          participants: [] as ConversationParticipant[],
        };
      })
    );

    return conversations;
  }

  /**
   * Get a single conversation with participants
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    const { data: conv, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (error) return null;

    // Get participants
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select(`
        *,
        profiles!user_id(id, username, display_name, avatar_url, status)
      `)
      .eq('conversation_id', conversationId);

    return {
      ...conv,
      participants: (participants || []).map(p => ({
        ...p,
        user: p.profiles,
      })) as ConversationParticipant[],
      lastMessageAt: conv.last_message_at,
    };
  }

  /**
   * Create a direct conversation with another user
   */
  async createDirectConversation(otherUserId: string): Promise<Conversation> {
    const userId = supabase.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (existing) {
      for (const p of existing) {
        const { data: other } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', p.conversation_id)
          .eq('user_id', otherUserId)
          .single();

        if (other) {
          return this.getConversation(p.conversation_id) as Promise<Conversation>;
        }
      }
    }

    // Create new conversation
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({
        type: 'direct',
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Add both participants
    await Promise.all([
      supabase.from('conversation_participants').insert({
        conversation_id: conv.id,
        user_id: userId,
      }),
      supabase.from('conversation_participants').insert({
        conversation_id: conv.id,
        user_id: otherUserId,
      }),
    ]);

    return this.getConversation(conv.id) as Promise<Conversation>;
  }

  /**
   * Create a team conversation
   */
  async createTeamConversation(teamId: string, name?: string): Promise<Conversation> {
    const userId = supabase.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({
        type: 'team',
        name: name || 'Team Chat',
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Get team members and add them
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', teamId);

    if (members) {
      const participants = members.map(m => ({
        conversation_id: conv.id,
        user_id: m.user_id,
        role: m.role === 'owner' || m.role === 'admin' ? 'admin' : 'member',
      }));
      await supabase.from('conversation_participants').insert(participants);
    }

    return this.getConversation(conv.id) as Promise<Conversation>;
  }

  /**
   * Create a project conversation
   */
  async createProjectConversation(projectId: string, name?: string): Promise<Conversation> {
    const userId = supabase.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({
        type: 'project',
        name: name || 'Project Chat',
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Get project members
    const { data: members } = await supabase
      .from('project_members')
      .select('user_id, role')
      .eq('project_id', projectId);

    if (members) {
      const participants = members.map(m => ({
        conversation_id: conv.id,
        user_id: m.user_id,
        role: m.role === 'admin' ? 'admin' : 'member',
      }));
      await supabase.from('conversation_participants').insert(participants);
    }

    return this.getConversation(conv.id) as Promise<Conversation>;
  }

  // ============================================================
  // MESSAGES
  // ============================================================

  /**
   * Get messages for a conversation with pagination
   */
  async getMessages(
    conversationId: string,
    limit: number = 50,
    before?: string
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    let query = supabase
      .from('messages')
      .select(`
        *,
        profiles!sender_id(id, username, display_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;
    if (error) throw error;

    const messages = (data || [])
      .slice(0, limit)
      .reverse()
      .map(m => ({
        ...m,
        sender: m.profiles,
        attachments: [],
        mentions: m.mentions || [],
        reactions: m.reactions || {},
      })) as Message[];

    const hasMore = (data || []).length > limit;

    return { messages, hasMore };
  }

  /**
   * Send a message
   */
  async sendMessage(
    conversationId: string,
    content: string,
    parentId?: string,
    mentions?: string[]
  ): Promise<Message> {
    const userId = supabase.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    // Parse mentions from content
    const extractedMentions = content.match(/@(\w+)/g)?.map(m => m.slice(1)) || mentions || [];

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        parent_id: parentId,
        mentions: extractedMentions,
        type: 'text',
      })
      .select(`
        *,
        profiles!sender_id(id, username, display_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    return {
      ...data,
      sender: data.profiles,
      attachments: [],
      mentions: data.mentions || [],
      reactions: data.reactions || {},
    } as Message;
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: string, content: string): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .update({ content, is_edited: true })
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true })
      .eq('id', messageId);

    if (error) throw error;
  }

  /**
   * Pin a message
   */
  async pinMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('messages')
      .update({ is_pinned: true })
      .eq('id', messageId);

    if (error) throw error;
  }

  /**
   * Add reaction to a message
   */
  async addReaction(messageId: string, emoji: string): Promise<void> {
    const userId = supabase.auth.user()?.id;
    if (!userId) return;

    const { data: msg } = await supabase
      .from('messages')
      .select('reactions')
      .eq('id', messageId)
      .single();

    if (msg) {
      const reactions = { ...msg.reactions } as Record<string, string[]>;
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }
      if (!reactions[emoji].includes(userId)) {
        reactions[emoji].push(userId);
      }
      
      await supabase
        .from('messages')
        .update({ reactions })
        .eq('id', messageId);
    }
  }

  /**
   * Remove reaction from a message
   */
  async removeReaction(messageId: string, emoji: string): Promise<void> {
    const userId = supabase.auth.user()?.id;
    if (!userId) return;

    const { data: msg } = await supabase
      .from('messages')
      .select('reactions')
      .eq('id', messageId)
      .single();

    if (msg) {
      const reactions = { ...msg.reactions } as Record<string, string[]>;
      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter(id => id !== userId);
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      }
      
      await supabase
        .from('messages')
        .update({ reactions })
        .eq('id', messageId);
    }
  }

  // ============================================================
  // TYPING INDICATORS
  // ============================================================

  private typingTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async sendTypingIndicator(conversationId: string): Promise<void> {
    const userId = supabase.auth.user()?.id;
    if (!userId) return;

    // Debounce typing indicator
    const key = `${conversationId}:${userId}`;
    if (this.typingTimeouts.has(key)) {
      clearTimeout(this.typingTimeouts.get(key)!);
    }

    // Send presence update via Supabase Realtime
    await supabase.channel(`presence:${conversationId}`)
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId, conversationId, isTyping: true },
      });

    // Auto-clear after 3 seconds
    this.typingTimeouts.set(
      key,
      setTimeout(async () => {
        await supabase.channel(`presence:${conversationId}`)
          .send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId, conversationId, isTyping: false },
          });
      }, 3000)
    );
  }

  // ============================================================
  // MARK AS READ
  // ============================================================

  async markAsRead(conversationId: string): Promise<void> {
    const userId = supabase.auth.user()?.id;
    if (!userId) return;

    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    const userId = supabase.auth.user()?.id;
    if (!userId) return;

    const { data: msg } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('id', messageId)
      .single();

    if (msg) {
      await this.markAsRead(msg.conversation_id);
    }
  }

  // ============================================================
  // UNREAD COUNT
  // ============================================================

  async getUnreadCount(conversationId: string): Promise<number> {
    const userId = supabase.auth.user()?.id;
    if (!userId) return 0;

    const { data: participant } = await supabase
      .from('conversation_participants')
      .select('last_read_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (!participant?.last_read_at) return 0;

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId || '')
      .gt('created_at', participant.last_read_at);

    return count || 0;
  }

  async getTotalUnreadCount(): Promise<number> {
    const { data: conversations } = await this.getConversations();
    let total = 0;
    for (const conv of conversations || []) {
      total += await this.getUnreadCount(conv.id);
    }
    return total;
  }

  // ============================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================

  subscribeToConversation(
    conversationId: string,
    onMessage: (message: Message) => void
  ): () => void {
    return subscribeToMessages(conversationId, onMessage);
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const messagingService = new MessagingService();
export default MessagingService;