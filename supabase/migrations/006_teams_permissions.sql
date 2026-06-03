-- Earth Guardians - Migration 006: Teams & Permissions
-- Adds team invite system, permissions matrix, and crew management enhancements

-- Team invite system
CREATE TABLE IF NOT EXISTS team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'crew_member',
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
    token VARCHAR(255) UNIQUE NOT NULL,
    message TEXT,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permission matrix
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role user_role NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, resource, action)
);

-- Crew join requests (alternative to invites)
CREATE TABLE IF NOT EXISTS crew_join_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(crew_id, user_id)
);

-- Crew roles within a crew
CREATE TABLE IF NOT EXISTS crew_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    role user_role DEFAULT 'crew_member',
    permissions JSONB DEFAULT '[]',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(crew_id, user_id)
);

-- Project permissions for granular access
CREATE TABLE IF NOT EXISTS project_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    permission VARCHAR(20) DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin', 'owner')),
    granted_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_invites_crew_id ON team_invites(crew_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON team_invites(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_invites_expires ON team_invites(expires_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_permissions_role ON permissions(role);
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);

CREATE INDEX IF NOT EXISTS idx_crew_join_requests_crew_id ON crew_join_requests(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_join_requests_user_id ON crew_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_join_requests_status ON crew_join_requests(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_crew_roles_crew_id ON crew_roles(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_roles_user_id ON crew_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_project_permissions_project_id ON project_permissions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_permissions_user_id ON project_permissions(user_id);

-- RLS Policies
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_permissions ENABLE ROW LEVEL SECURITY;

-- Team invites viewable by inviter or recipient email
CREATE POLICY "Team invites viewable by inviter" ON team_invites
    FOR SELECT USING (invited_by = auth.uid());

CREATE POLICY "Team invites viewable by email (with token)" ON team_invites
    FOR SELECT USING (true);

CREATE POLICY "Team invites insertable by crew leaders" ON team_invites
    FOR INSERT WITH CHECK (
        crew_id IN (SELECT id FROM crews WHERE created_by = auth.uid())
    );

CREATE POLICY "Team invites updateable by inviter" ON team_invites
    FOR UPDATE USING (
        invited_by = auth.uid()
        OR crew_id IN (SELECT id FROM crews WHERE created_by = auth.uid())
    );

-- Permissions readable by all authenticated users
CREATE POLICY "Permissions readable by all" ON permissions
    FOR SELECT USING (true);

-- Crew join requests
CREATE POLICY "Crew join requests viewable by crew leaders" ON crew_join_requests
    FOR SELECT USING (
        crew_id IN (SELECT id FROM crews WHERE created_by = auth.uid())
        OR user_id = auth.uid()
    );

CREATE POLICY "Crew join requests insertable by users" ON crew_join_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Crew join requests updateable by crew leaders" ON crew_join_requests
    FOR UPDATE USING (
        crew_id IN (SELECT id FROM crews WHERE created_by = auth.uid())
    );

-- Crew roles viewable by crew members
CREATE POLICY "Crew roles viewable by crew members" ON crew_roles
    FOR SELECT USING (
        crew_id IN (SELECT crew_id FROM crew_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Crew roles manageable by crew leaders" ON crew_roles
    FOR ALL USING (
        crew_id IN (SELECT id FROM crews WHERE created_by = auth.uid())
    );

-- Project permissions
CREATE POLICY "Project permissions viewable by project access" ON project_permissions
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE created_by = auth.uid()
            OR crew_id IN (SELECT crew_id FROM crew_members WHERE user_id = auth.uid())
        )
        OR user_id = auth.uid()
    );

CREATE POLICY "Project permissions manageable by project owners" ON project_permissions
    FOR ALL USING (
        project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
    );

-- Default permissions data
INSERT INTO permissions (role, resource, action, description) VALUES
    ('staff', 'profiles', 'read', 'View all user profiles'),
    ('staff', 'profiles', 'update', 'Update own profile'),
    ('staff', 'projects', 'create', 'Create new projects'),
    ('staff', 'projects', 'read', 'View projects'),
    ('staff', 'projects', 'update', 'Update own projects'),
    ('staff', 'projects', 'delete', 'Delete own projects'),
    ('staff', 'tasks', 'create', 'Create tasks'),
    ('staff', 'tasks', 'read', 'View tasks'),
    ('staff', 'tasks', 'update', 'Update own tasks'),
    ('staff', 'tasks', 'delete', 'Delete own tasks'),
    ('staff', 'documents', 'create', 'Create documents'),
    ('staff', 'documents', 'read', 'View documents'),
    ('staff', 'documents', 'update', 'Update own documents'),
    ('staff', 'documents', 'delete', 'Delete own documents'),
    
    ('regional_councilor', 'profiles', 'read', 'View all user profiles'),
    ('regional_councilor', 'profiles', 'update', 'Update own profile'),
    ('regional_councilor', 'regions', 'manage', 'Manage regions'),
    ('regional_councilor', 'projects', 'create', 'Create projects'),
    ('regional_councilor', 'projects', 'read', 'View all region projects'),
    ('regional_councilor', 'projects', 'update', 'Update any project in region'),
    ('regional_councilor', 'projects', 'delete', 'Delete region projects'),
    ('regional_councilor', 'crews', 'manage', 'Manage crews in region'),
    ('regional_councilor', 'tasks', 'create', 'Create tasks'),
    ('regional_councilor', 'tasks', 'read', 'View all tasks'),
    ('regional_councilor', 'tasks', 'update', 'Update any task'),
    ('regional_councilor', 'tasks', 'delete', 'Delete tasks'),
    
    ('crew_leader', 'profiles', 'read', 'View profiles'),
    ('crew_leader', 'profiles', 'update', 'Update own profile'),
    ('crew_leader', 'projects', 'read', 'View crew projects'),
    ('crew_leader', 'projects', 'update', 'Update crew projects'),
    ('crew_leader', 'crew_members', 'manage', 'Manage crew members'),
    ('crew_leader', 'crew_members', 'invite', 'Invite crew members'),
    ('crew_leader', 'tasks', 'create', 'Create tasks'),
    ('crew_leader', 'tasks', 'read', 'View crew tasks'),
    ('crew_leader', 'tasks', 'update', 'Update crew tasks'),
    ('crew_leader', 'tasks', 'delete', 'Delete crew tasks'),
    ('crew_leader', 'documents', 'create', 'Create documents'),
    ('crew_leader', 'documents', 'read', 'View documents'),
    ('crew_leader', 'documents', 'update', 'Update documents'),
    
    ('crew_member', 'profiles', 'read', 'View profiles'),
    ('crew_member', 'profiles', 'update', 'Update own profile'),
    ('crew_member', 'projects', 'read', 'View assigned projects'),
    ('crew_member', 'tasks', 'create', 'Create tasks'),
    ('crew_member', 'tasks', 'read', 'View assigned tasks'),
    ('crew_member', 'tasks', 'update', 'Update own tasks'),
    ('crew_member', 'documents', 'read', 'View documents'),
    ('crew_member', 'documents', 'create', 'Create documents'),
    
    ('stakeholder', 'projects', 'read', 'View project summaries'),
    ('stakeholder', 'tasks', 'read', 'View task summaries'),
    
    ('partner', 'projects', 'read', 'View public project information');

-- Functions for team management

-- Function to create team invite
CREATE OR REPLACE FUNCTION create_team_invite(
    p_crew_id UUID,
    p_email VARCHAR,
    p_role user_role DEFAULT 'crew_member',
    p_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    invite_id UUID;
    invite_token VARCHAR(255);
BEGIN
    -- Generate secure token
    invite_token := encode(gen_random_bytes(32), 'hex');
    
    INSERT INTO team_invites (crew_id, email, role, invited_by, message, token)
    VALUES (p_crew_id, p_email, p_role, auth.uid(), p_message, invite_token)
    RETURNING id INTO invite_id;
    
    -- Log activity
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'team_invite_sent', 'team_invite', invite_id, jsonb_build_object('email', p_email, 'crew_id', p_crew_id));
    
    RETURN invite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept team invite
CREATE OR REPLACE FUNCTION accept_team_invite(p_token VARCHAR)
RETURNS UUID AS $$
DECLARE
    invite_record RECORD;
    member_id UUID;
BEGIN
    -- Get invite
    SELECT * INTO invite_record FROM team_invites
    WHERE token = p_token AND status = 'pending' AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invite';
    END IF;
    
    -- Add to crew members
    INSERT INTO crew_members (crew_id, user_id, role)
    VALUES (invite_record.crew_id, auth.uid(), invite_record.role)
    ON CONFLICT (crew_id, user_id) DO UPDATE SET role = invite_record.role
    RETURNING id INTO member_id;
    
    -- Update invite status
    UPDATE team_invites
    SET status = 'accepted', responded_at = NOW()
    WHERE id = invite_record.id;
    
    -- Log activity
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'team_invite_accepted', 'team_invite', invite_record.id, jsonb_build_object('crew_id', invite_record.crew_id));
    
    RETURN member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decline team invite
CREATE OR REPLACE FUNCTION decline_team_invite(p_token VARCHAR)
RETURNS VOID AS $$
DECLARE
    invite_record RECORD;
BEGIN
    SELECT * INTO invite_record FROM team_invites
    WHERE token = p_token AND status = 'pending' AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invite';
    END IF;
    
    UPDATE team_invites
    SET status = 'declined', responded_at = NOW()
    WHERE id = invite_record.id;
    
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (auth.uid(), 'team_invite_declined', 'team_invite', invite_record.id, jsonb_build_object('crew_id', invite_record.crew_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user permission
CREATE OR REPLACE FUNCTION check_permission(
    p_user_role user_role,
    p_resource VARCHAR,
    p_action VARCHAR
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM permissions 
        WHERE role = p_user_role 
        AND resource = p_resource 
        AND action = p_action
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user permissions for a crew
CREATE OR REPLACE FUNCTION get_crew_permissions(p_crew_id UUID)
RETURNS TABLE(
    role user_role,
    resource VARCHAR,
    action VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.role, p.resource, p.action
    FROM permissions p
    WHERE p.role IN (
        SELECT cr.role FROM crew_roles cr
        WHERE cr.crew_id = p_crew_id AND cr.user_id = auth.uid()
        UNION
        SELECT cm.role FROM crew_members cm
        WHERE cm.crew_id = p_crew_id AND cm.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve crew join request
CREATE OR REPLACE FUNCTION approve_join_request(p_request_id UUID)
RETURNS UUID AS $$
DECLARE
    request_record RECORD;
    member_id UUID;
BEGIN
    SELECT * INTO request_record FROM crew_join_requests
    WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or pending request not found';
    END IF;
    
    -- Add to crew members
    INSERT INTO crew_members (crew_id, user_id, role)
    VALUES (request_record.crew_id, request_record.user_id, 'crew_member')
    ON CONFLICT (crew_id, user_id) DO NOTHING
    RETURNING id INTO member_id;
    
    -- Update request status
    UPDATE crew_join_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
    WHERE id = p_request_id;
    
    RETURN member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to grant project permission
CREATE OR REPLACE FUNCTION grant_project_permission(
    p_project_id UUID,
    p_user_id UUID,
    p_permission VARCHAR
)
RETURNS UUID AS $$
DECLARE
    perm_id UUID;
BEGIN
    INSERT INTO project_permissions (project_id, user_id, permission, granted_by)
    VALUES (p_project_id, p_user_id, p_permission, auth.uid())
    ON CONFLICT (project_id, user_id) DO UPDATE SET permission = p_permission, granted_by = auth.uid()
    RETURNING id INTO perm_id;
    
    RETURN perm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-expire invites
CREATE OR REPLACE FUNCTION expire_old_invites()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE team_invites
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-cleanup expired invites
CREATE TRIGGER on_invite_check
AFTER INSERT ON team_invites
FOR EACH STATEMENT 
WHEN (floor(random() * 50)::int = 0)
EXECUTE FUNCTION expire_old_invites();

-- Comments
COMMENT ON TABLE team_invites IS 'Email invitations to join crews';
COMMENT ON TABLE permissions IS 'Role-based permission matrix';
COMMENT ON TABLE crew_join_requests IS 'User-initiated requests to join crews';
COMMENT ON TABLE crew_roles IS 'Per-crew role assignments';
COMMENT ON TABLE project_permissions IS 'Granular project access control';

-- Update existing crew_members table with additional fields
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS invite_source VARCHAR(50);

-- Create index for crew membership lookup
CREATE INDEX IF NOT EXISTS idx_crew_members_user_crew ON crew_members(user_id, crew_id);