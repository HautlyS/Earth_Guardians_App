/**
 * Earth Guardians App - Team Management Service
 * Handles team creation, member management, and permissions
 */

import { supabase } from '../core/supabase';
import type { Team, TeamMember, User, UserRole, TeamSettings } from '../types';

// ============================================================
// TEAM SERVICE
// ============================================================

export class TeamService {
  /**
   * Get all teams for the current user
   */
  async getUserTeams(): Promise<Team[]> {
    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        team_members!inner(user_id)
      `)
      .eq('team_members.user_id', supabase.auth.user()?.id || '')
      .eq('status', 'active');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a specific team by ID
   */
  async getTeam(teamId: string): Promise<Team | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Get team by slug
   */
  async getTeamBySlug(slug: string): Promise<Team | null> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Create a new team
   */
  async createTeam(
    name: string,
    slug: string,
    description?: string,
    avatarUrl?: string
  ): Promise<Team> {
    const userId = supabase.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('teams')
      .insert({
        name,
        slug,
        description,
        avatar_url: avatarUrl,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Add creator as owner
    await this.addMember(data.id, userId, 'owner');

    return data;
  }

  /**
   * Update team details
   */
  async updateTeam(
    teamId: string,
    updates: Partial<{
      name: string;
      description: string;
      avatar_url: string;
      cover_url: string;
      settings: TeamSettings;
    }>
  ): Promise<Team> {
    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Archive a team (soft delete)
   */
  async archiveTeam(teamId: string): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .update({ status: 'archived' })
      .eq('id', teamId);

    if (error) throw error;
  }

  /**
   * Delete a team permanently
   */
  async deleteTeam(teamId: string): Promise<void> {
    const { error } = await supabase
      .from('teams')
      .update({ status: 'deleted' })
      .eq('id', teamId);

    if (error) throw error;
  }

  // ============================================================
  // MEMBER MANAGEMENT
  // ============================================================

  /**
   * Get team members
   */
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        profiles!user_id(id, username, display_name, avatar_url, role, status)
      `)
      .eq('team_id', teamId);

    if (error) throw error;
    return (data || []).map(m => ({
      ...m,
      user: m.profiles,
    })) as TeamMember[];
  }

  /**
   * Add a member to a team
   */
  async addMember(
    teamId: string,
    userId: string,
    role: UserRole = 'member',
    invitedBy?: string
  ): Promise<TeamMember> {
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        role,
        invited_by: invitedBy,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Add member by email invitation
   */
  async inviteMember(
    teamId: string,
    email: string,
    role: UserRole = 'member'
  ): Promise<void> {
    // Create or find user by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .single();

    if (profile) {
      await this.addMember(teamId, profile.user_id, role);
    }

    // TODO: Send invitation email if user doesn't exist
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    teamId: string,
    userId: string,
    role: UserRole
  ): Promise<void> {
    const { error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Remove member from team
   */
  async removeMember(teamId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /**
   * Leave a team
   */
  async leaveTeam(teamId: string): Promise<void> {
    const userId = supabase.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    await this.removeMember(teamId, userId);
  }

  // ============================================================
  // PERMISSIONS
  // ============================================================

  /**
   * Check if user has permission for an action
   */
  async hasPermission(
    teamId: string,
    userId: string,
    action: 'manage' | 'edit' | 'view' | 'invite'
  ): Promise<boolean> {
    const { data } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (!data) return false;

    const roleHierarchy: Record<UserRole, number> = {
      owner: 100,
      admin: 80,
      moderator: 60,
      staff: 40,
      member: 20,
      guest: 10,
    };

    const roleLevel = roleHierarchy[data.role as UserRole] || 0;

    switch (action) {
      case 'manage':
        return roleLevel >= 80;
      case 'edit':
        return roleLevel >= 40;
      case 'invite':
        return roleLevel >= 60;
      case 'view':
        return roleLevel >= 10;
      default:
        return false;
    }
  }

  /**
   * Get user's role in a team
   */
  async getUserRole(teamId: string, userId?: string): Promise<UserRole | null> {
    const uid = userId || supabase.auth.user()?.id;
    if (!uid) return null;

    const { data } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', uid)
      .single();

    return data?.role as UserRole || null;
  }

  // ============================================================
  // SEARCH & DISCOVERY
  // ============================================================

  /**
   * Search for users to add to team
   */
  async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const teamService = new TeamService();
export default TeamService;