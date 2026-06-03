-- Earth Guardians - Migration 004: Projects & Tasks Enhancement
-- Adds extended project and task fields, activity feed, comments, and attachments

-- Add extended project fields
ALTER TABLE projects ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private' 
    CHECK (visibility IN ('public', 'private', 'team'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium' 
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;

-- Add extended task fields
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium' 
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(8,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(8,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependencies UUID[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id);

-- Project activity feed
CREATE TABLE IF NOT EXISTS project_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task comments
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    mentions UUID[] DEFAULT '{}',
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task attachments (file references)
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    storage_path TEXT,
    thumbnail_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task dependencies tracking
CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, depends_on_task_id)
);

-- Project templates
CREATE TABLE IF NOT EXISTS project_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content JSONB NOT NULL DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    is_public BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_crew_id ON projects(crew_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignees ON tasks USING GIN(assignees);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(position);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_user_id ON project_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_created_at ON project_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activities_action ON project_activities(action);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_mentions ON task_comments USING GIN(mentions);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);

CREATE INDEX IF NOT EXISTS idx_project_templates_public ON project_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_project_templates_created_by ON project_templates(created_by);

-- RLS Policies
ALTER TABLE project_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

-- Project activities visible to project members (via crew)
CREATE POLICY "Project activities viewable by crew members" ON project_activities
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p
            WHERE p.crew_id IN (
                SELECT cm.crew_id FROM crew_members cm WHERE cm.user_id = auth.uid()
            )
            OR p.created_by = auth.uid()
        )
    );

CREATE POLICY "Project activities insertable by project members" ON project_activities
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Task comments visible to task assignees
CREATE POLICY "Task comments viewable by task assignees" ON task_comments
    FOR SELECT USING (
        task_id IN (
            SELECT id FROM tasks WHERE auth.uid() = ANY(assignees)
        )
        OR user_id = auth.uid()
    );

CREATE POLICY "Task comments editable by author" ON task_comments
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Task comments insertable by crew members" ON task_comments
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Task attachments visible to task assignees
CREATE POLICY "Task attachments viewable by task assignees" ON task_attachments
    FOR SELECT USING (
        task_id IN (
            SELECT id FROM tasks WHERE auth.uid() = ANY(assignees)
        )
        OR uploaded_by = auth.uid()
    );

CREATE POLICY "Task attachments editable by uploader" ON task_attachments
    FOR ALL USING (uploaded_by = auth.uid());

-- Task dependencies viewable by all (for planning)
CREATE POLICY "Task dependencies viewable by crew members" ON task_dependencies
    FOR SELECT USING (true);

CREATE POLICY "Task dependencies manageable by task creators" ON task_dependencies
    FOR ALL USING (
        task_id IN (SELECT id FROM tasks WHERE created_at IN (SELECT id FROM tasks WHERE TRUE))
    );

-- Project templates
CREATE POLICY "Project templates viewable by public" ON project_templates
    FOR SELECT USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Project templates editable by creator" ON project_templates
    FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Project templates insertable by authenticated users" ON project_templates
    FOR INSERT WITH CHECK (created_by = auth.uid());

-- Functions for projects and tasks

-- Function to update project status based on all tasks completion
CREATE OR REPLACE FUNCTION check_project_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'done' THEN
        UPDATE projects SET status = 'completed' WHERE id = NEW.project_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-complete project when all tasks done
CREATE TRIGGER on_task_completion
AFTER UPDATE ON tasks
FOR EACH ROW 
WHEN (NEW.status = 'done' AND OLD.status != 'done')
EXECUTE FUNCTION check_project_completion();

-- Function to log project activity
CREATE OR REPLACE FUNCTION log_project_activity(
    p_project_id UUID,
    p_user_id UUID,
    p_action VARCHAR,
    p_entity_type VARCHAR DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO project_activities (project_id, user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (p_project_id, p_user_id, p_action, p_entity_type, p_entity_id, p_old_data, p_new_data)
    RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update comments count
CREATE OR REPLACE FUNCTION update_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tasks SET comments_count = comments_count + 1 WHERE id = NEW.task_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tasks SET comments_count = comments_count - 1 WHERE id = OLD.task_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update comments count
CREATE TRIGGER on_comment_change
AFTER INSERT OR DELETE ON task_comments
FOR EACH ROW
EXECUTE FUNCTION update_comments_count();

-- Function to calculate task progress
CREATE OR REPLACE FUNCTION calculate_task_progress(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
    total_tasks INTEGER;
    completed_tasks INTEGER;
    in_progress_tasks INTEGER;
    progress_data JSONB;
BEGIN
    SELECT COUNT(*) INTO total_tasks FROM tasks WHERE project_id = p_project_id AND deleted_at IS NULL;
    SELECT COUNT(*) INTO completed_tasks FROM tasks WHERE project_id = p_project_id AND status = 'done' AND deleted_at IS NULL;
    SELECT COUNT(*) INTO in_progress_tasks FROM tasks WHERE project_id = p_project_id AND status = 'in_progress' AND deleted_at IS NULL;
    
    progress_data := jsonb_build_object(
        'total', total_tasks,
        'completed', completed_tasks,
        'in_progress', in_progress_tasks,
        'percentage', CASE WHEN total_tasks > 0 THEN (completed_tasks::numeric / total_tasks * 100)::integer ELSE 0 END
    );
    
    RETURN progress_data;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE project_activities IS 'Project activity feed for team collaboration and audit';
COMMENT ON TABLE task_comments IS 'Task discussion and comments';
COMMENT ON TABLE task_attachments IS 'Task file attachments with storage references';
COMMENT ON TABLE task_dependencies IS 'Task dependency relationships for planning';
COMMENT ON TABLE project_templates IS 'Reusable project templates for quick project creation';

-- Update existing tasks table to have proper assignees array
ALTER TABLE tasks ALTER COLUMN assignees SET DEFAULT '{}';