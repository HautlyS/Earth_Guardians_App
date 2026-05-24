/**
 * Earth Guardians App - Project Management Service
 * Handles project creation, tasks, and real-time collaboration
 */

import { supabase, subscribeToTasks } from '../core/supabase';
import type { Project, Task, TaskComment, ProjectMember, ProjectStatus, TaskPriority, TaskStatus } from '../types';

// ============================================================
// PROJECT SERVICE
// ============================================================

export class ProjectService {
  /**
   * Get all projects for a team
   */
  async getTeamProjects(teamId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*, team:teams(*)')
      .eq('id', projectId)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Create a new project
   */
  async createProject(params: {
    teamId: string;
    name: string;
    description?: string;
    priority?: TaskPriority;
    color?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Project> {
    const userId = supabase.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('projects')
      .insert({
        team_id: params.teamId,
        name: params.name,
        description: params.description,
        priority: params.priority || 'medium',
        color: params.color || '#3B82F6',
        start_date: params.startDate,
        end_date: params.endDate,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Add creator as project admin
    await this.addMember(data.id, userId, 'admin', true, true);

    return data;
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    updates: Partial<{
      name: string;
      description: string;
      status: ProjectStatus;
      priority: TaskPriority;
      color: string;
      start_date: string;
      end_date: string;
    }>
  ): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Archive a project
   */
  async archiveProject(projectId: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update({ status: 'archived' })
      .eq('id', projectId);

    if (error) throw error;
  }

  // ============================================================
  // PROJECT MEMBERS
  // ============================================================

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        profiles!user_id(id, username, display_name, avatar_url)
      `)
      .eq('project_id', projectId);

    if (error) throw error;
    return data || [];
  }

  async addMember(
    projectId: string,
    userId: string,
    role: string = 'member',
    canEdit: boolean = false,
    canDelete: boolean = false
  ): Promise<ProjectMember> {
    const { data, error } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: userId,
        role,
        can_edit: canEdit,
        can_delete: canDelete,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // ============================================================
  // TASK MANAGEMENT
  // ============================================================

  async getProjectTasks(projectId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assignees:tasks!assignees(profiles!user_id(id, username, display_name, avatar_url))
      `)
      .eq('project_id', projectId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return this.buildTaskTree(data || []);
  }

  private buildTaskTree(flatTasks: any[]): Task[] {
    const taskMap = new Map<string, Task>();
    const roots: Task[] = [];

    // First pass: create all tasks
    flatTasks.forEach(t => {
      taskMap.set(t.id, { ...t, subtasks: [] });
    });

    // Second pass: build tree
    flatTasks.forEach(t => {
      const task = taskMap.get(t.id)!;
      if (t.parent_id && taskMap.has(t.parent_id)) {
        taskMap.get(t.parent_id)!.subtasks!.push(task);
      } else {
        roots.push(task);
      }
    });

    return roots;
  }

  async getTask(taskId: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) return null;
    return data;
  }

  async createTask(params: {
    projectId: string;
    title: string;
    description?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    assignees?: string[];
    labels?: string[];
    dueDate?: string;
    parentId?: string;
  }): Promise<Task> {
    const userId = supabase.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        project_id: params.projectId,
        title: params.title,
        description: params.description,
        priority: params.priority || 'medium',
        status: params.status || 'todo',
        assignees: params.assignees || [],
        labels: params.labels || [],
        due_date: params.dueDate,
        parent_id: params.parentId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateTask(
    taskId: string,
    updates: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      priority: TaskPriority;
      assignees: string[];
      labels: string[];
      due_date: string;
      progress: number;
    }>
  ): Promise<Task> {
    const updateData: any = { ...updates };
    
    // Set completed_at if status changes to done
    if (updates.status === 'done') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteTask(taskId: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  }

  async reorderTasks(projectId: string, taskIds: string[]): Promise<void> {
    const updates = taskIds.map((id, index) =>
      supabase.from('tasks').update({ order_index: index }).eq('id', id)
    );
    
    await Promise.all(updates);
  }

  // ============================================================
  // TASK COMMENTS
  // ============================================================

  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    const { data, error } = await supabase
      .from('task_comments')
      .select(`
        *,
        profiles!user_id(id, username, display_name, avatar_url)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(c => ({
      ...c,
      user: c.profiles,
    })) as TaskComment[];
  }

  async addComment(taskId: string, content: string, parentId?: string): Promise<TaskComment> {
    const userId = supabase.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        content,
        user_id: userId,
        parent_id: parentId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateComment(commentId: string, content: string): Promise<TaskComment> {
    const { data, error } = await supabase
      .from('task_comments')
      .update({ content, is_edited: true })
      .eq('id', commentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteComment(commentId: string): Promise<void> {
    const { error } = await supabase
      .from('task_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
  }

  // ============================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================

  subscribeToProjectChanges(
    projectId: string,
    onTaskChange: (task: Task, eventType: string) => void
  ): () => void {
    return subscribeToTasks(projectId, onTaskChange);
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  async getProjectStats(projectId: string): Promise<{
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    completionRate: number;
  }> {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('status, due_date, completed_at')
      .eq('project_id', projectId);

    if (!tasks) {
      return { totalTasks: 0, completedTasks: 0, inProgressTasks: 0, overdueTasks: 0, completionRate: 0 };
    }

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const now = new Date();
    const overdueTasks = tasks.filter(t => 
      t.due_date && new Date(t.due_date) < now && t.status !== 'done'
    ).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { totalTasks, completedTasks, inProgressTasks, overdueTasks, completionRate };
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const projectService = new ProjectService();
export default ProjectService;