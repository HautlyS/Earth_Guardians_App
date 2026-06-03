# Earth Guardians Platform - Implementation Tasks

> Comprehensive task list for building a 100% Supabase edge function backend with GitHub Pages frontend.

---

## 📋 Table of Contents

1. [Critical Issues](#critical-issues)
2. [Database Migrations](#database-migrations)
3. [Edge Functions](#edge-functions)
4. [Frontend Components](#frontend-components)
5. [Supabase Integration](#supabase-integration)
6. [P2P Networking](#p2p-networking)
7. [Authentication & Security](#authentication--security)
8. [Features & Enhancements](#features--enhancements)
9. [Infrastructure & Deploy](#infrastructure--deploy)

---

## 🚨 Critical Issues

| # | Issue | Severity | Files Affected |
|---|-------|----------|----------------|
| 1 | Duplicate P2P manager - imports from `src/p2p/` but web has stub in `src/utils/p2p-manager.ts` | 🔴 HIGH | `apps/web/src/App.vue`, `apps/web/src/utils/p2p-manager.ts`, `src/p2p/p2p-manager.ts` |
| 2 | No Supabase client initialization in web app | 🔴 HIGH | `apps/web/src/main.ts` |
| 3 | Missing Vue Router setup - App.vue uses `router-link` but no router configured | 🔴 HIGH | `apps/web/src/App.vue`, `apps/web/src/main.ts` |
| 4 | Missing Pinia stores - architecture docs mention stores but none exist | 🔴 HIGH | `apps/web/src/` |
| 5 | Incomplete migration - missing indexes, triggers, functions | 🟡 MEDIUM | `supabase/migrations/001_initial_schema.sql` |
| 6 | Missing RLS policies for crew_members, tasks, projects tables | 🟡 MEDIUM | `supabase/migrations/001_initial_schema.sql` |
| 7 | Edge functions lack proper error handling and logging | 🟡 MEDIUM | `supabase/functions/email/*` |
| 8 | No environment configuration for Supabase in web app | 🟡 MEDIUM | `apps/web/src/utils/config.ts` |

---

## 🗄️ Database Migrations

### Migration 002: Enhanced Profiles & Settings

```sql
-- supabase/migrations/002_enhanced_profiles.sql

-- Add profile enhancements
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_data TEXT; -- Base64 for custom avatars
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_on_mention BOOLEAN DEFAULT true,
    email_on_task_assign BOOLEAN DEFAULT true,
    email_on_project_update BOOLEAN DEFAULT true,
    email_on_message BOOLEAN DEFAULT true,
    push_on_mention BOOLEAN DEFAULT true,
    push_on_task_assign BOOLEAN DEFAULT true,
    push_on_project_update BOOLEAN DEFAULT false,
    push_on_message BOOLEAN DEFAULT true,
    in_app_on_mention BOOLEAN DEFAULT true,
    in_app_on_task_assign BOOLEAN DEFAULT true,
    in_app_on_project_update BOOLEAN DEFAULT true,
    in_app_on_message BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User sessions for multi-device support
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id);

-- Function to update last seen
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles SET last_seen_at = NOW(), is_online = true WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_activity
AFTER INSERT ON user_sessions
FOR EACH ROW EXECUTE FUNCTION update_last_seen();
```

### Migration 003: P2P Signaling & Connections

```sql
-- supabase/migrations/003_p2p_signaling.sql

-- P2P peer registry
CREATE TABLE IF NOT EXISTS p2p_peers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    peer_id VARCHAR(255) NOT NULL,
    public_key TEXT,
    connection_info JSONB DEFAULT '{}',
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- P2P signaling messages
CREATE TABLE IF NOT EXISTS p2p_signaling (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_peer_id UUID NOT NULL REFERENCES auth.users(id),
    to_peer_id UUID NOT NULL REFERENCES auth.users(id),
    signal_type VARCHAR(20) NOT NULL, -- 'offer', 'answer', 'ice-candidate', 'leave'
    payload JSONB NOT NULL,
    is_delivered BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- P2P connections history
CREATE TABLE IF NOT EXISTS p2p_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    peer_a_id UUID NOT NULL REFERENCES auth.users(id),
    peer_b_id UUID NOT NULL REFERENCES auth.users(id),
    connection_type VARCHAR(20) DEFAULT 'direct', -- 'direct', 'relayed'
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'disconnected', 'failed'
    metadata JSONB DEFAULT '{}',
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_p2p_peers_user_id ON p2p_peers(user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_peers_peer_id ON p2p_peers(peer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_signaling_from ON p2p_signaling(from_peer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_signaling_to ON p2p_signaling(to_peer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_signaling_not_delivered ON p2p_signaling(is_delivered) WHERE is_delivered = false;
CREATE INDEX IF NOT EXISTS idx_p2p_connections_peers ON p2p_connections(peer_a_id, peer_b_id);

-- RLS Policies
ALTER TABLE p2p_peers ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_signaling ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own peer record" ON p2p_peers
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can send signals to each other" ON p2p_signaling
    FOR ALL USING (from_peer_id = auth.uid() OR to_peer_id = auth.uid());

CREATE POLICY "Users can view own connections" ON p2p_connections
    FOR SELECT USING (peer_a_id = auth.uid() OR peer_b_id = auth.uid());

-- Function to clean up expired signaling messages
CREATE OR REPLACE FUNCTION cleanup_expired_signals()
RETURNS void AS $$
BEGIN
    DELETE FROM p2p_signaling WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to cleanup signals every hour
CREATE OR REPLACE FUNCTION schedule_cleanup()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM cleanup_expired_signals();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup on new signal insert
CREATE TRIGGER on_signal_insert_cleanup
AFTER INSERT ON p2p_signaling
FOR EACH STATEMENT EXECUTE FUNCTION schedule_cleanup();
```

### Migration 004: Projects & Tasks Enhancement

```sql
-- supabase/migrations/004_projects_tasks_enhancement.sql

-- Project enhancements
ALTER TABLE projects ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget DECIMAL(12,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Task enhancements
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(8,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(8,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS dependencies UUID[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments for tasks
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    mentions UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task attachments
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    storage_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_crew_id ON projects(crew_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignees ON tasks USING GIN(assignees);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_created_at ON project_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

-- RLS Policies for new tables
ALTER TABLE project_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project activities viewable by crew members" ON project_activities
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE crew_id IN (
                SELECT crew_id FROM crew_members WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Project activities editable by project members" ON project_activities
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Task comments viewable by assignees" ON task_comments
    FOR SELECT USING (
        task_id IN (
            SELECT id FROM tasks WHERE assignees @> ARRAY[auth.uid()] OR auth.uid() = ANY(assignees)
        )
    );

CREATE POLICY "Task comments editable by author" ON task_comments
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Task attachments viewable by assignees" ON task_attachments
    FOR SELECT USING (
        task_id IN (
            SELECT id FROM tasks WHERE assignees @> ARRAY[auth.uid()]
        )
    );

CREATE POLICY "Task attachments editable by author" ON task_attachments
    FOR ALL USING (user_id = auth.uid());

-- Function to update project status based on tasks
CREATE OR REPLACE FUNCTION update_project_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'done' THEN
        UPDATE projects SET status = 'completed' WHERE id = NEW.project_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_task_completion
AFTER UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_project_status();

-- Function to create activity on project changes
CREATE OR REPLACE FUNCTION log_project_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO project_activities (project_id, user_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (NEW.project_id, auth.uid(), 'update', 'project', NEW.id, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_project_update
AFTER UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION log_project_activity();
```

### Migration 005: Documents & Storage

```sql
-- supabase/migrations/005_documents_storage.sql

-- Document versions
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);

-- Document sharing
CREATE TABLE IF NOT EXISTS document_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    shared_with UUID NOT NULL REFERENCES auth.users(id),
    permission VARCHAR(20) DEFAULT 'view', -- 'view', 'edit', 'admin'
    shared_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, shared_with)
);

-- Storage metadata
CREATE TABLE IF NOT EXISTS storage_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    storage_path TEXT NOT NULL,
    bucket VARCHAR(100) DEFAULT 'assets',
    encryption_key TEXT,
    compression_used BOOLEAN DEFAULT false,
    thumbnail_path TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_document_versions_doc_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_doc_id ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_user_id ON document_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_storage_metadata_user_id ON storage_metadata(user_id);

-- RLS Policies
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Document versions viewable by document access" ON document_versions
    FOR SELECT USING (
        document_id IN (
            SELECT id FROM documents WHERE creator_id = auth.uid() OR is_public = true
        )
    );

CREATE POLICY "Document versions editable by document owner" ON document_versions
    FOR INSERT WITH CHECK (
        document_id IN (SELECT id FROM documents WHERE creator_id = auth.uid())
    );

CREATE POLICY "Document shares viewable by recipient" ON document_shares
    FOR SELECT USING (shared_with = auth.uid() OR shared_by = auth.uid());

CREATE POLICY "Document shares manageable by owner" ON document_shares
    FOR ALL USING (
        document_id IN (SELECT id FROM documents WHERE creator_id = auth.uid())
    );

CREATE POLICY "Storage metadata viewable by owner" ON storage_metadata
    FOR ALL USING (user_id = auth.uid());
```

### Migration 006: Teams & Permissions

```sql
-- supabase/migrations/006_teams_permissions.sql

-- Team invite system
CREATE TABLE IF NOT EXISTS team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'crew_member',
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permission matrix
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role user_role NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, resource, action)
);

-- Default permissions
INSERT INTO permissions (role, resource, action) VALUES
    ('staff', 'projects', 'create'),
    ('staff', 'projects', 'read'),
    ('staff', 'projects', 'update'),
    ('staff', 'projects', 'delete'),
    ('staff', 'tasks', 'create'),
    ('staff', 'tasks', 'read'),
    ('staff', 'tasks', 'update'),
    ('staff', 'tasks', 'delete'),
    ('regional_councilor', 'projects', 'create'),
    ('regional_councilor', 'projects', 'read'),
    ('regional_councilor', 'projects', 'update'),
    ('regional_councilor', 'projects', 'delete'),
    ('regional_councilor', 'regions', 'manage'),
    ('crew_leader', 'projects', 'read'),
    ('crew_leader', 'projects', 'update'),
    ('crew_leader', 'crew_members', 'manage'),
    ('crew_member', 'projects', 'read'),
    ('crew_member', 'tasks', 'create'),
    ('crew_member', 'tasks', 'read'),
    ('crew_member', 'tasks', 'update'),
    ('stakeholder', 'projects', 'read'),
    ('partner', 'projects', 'read');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_invites_crew_id ON team_invites(crew_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON team_invites(status) WHERE status = 'pending';

-- RLS
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team invites viewable by crew leaders" ON team_invites
    FOR SELECT USING (
        crew_id IN (SELECT id FROM crews WHERE created_by = auth.uid())
    );

CREATE POLICY "Team invites manageable by crew leaders" ON team_invites
    FOR ALL USING (
        crew_id IN (SELECT id FROM crews WHERE created_by = auth.uid())
    );

CREATE POLICY "Permissions readable by all" ON permissions
    FOR SELECT USING (true);

-- Function to check role permissions
CREATE OR REPLACE FUNCTION check_permission(user_role user_role, resource TEXT, action TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM permissions WHERE role = user_role AND resource = resource AND action = action
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## ⚡ Edge Functions

### 1. Authentication Edge Functions

#### `auth/send-magic-link.ts`
```typescript
// supabase/functions/auth/send-magic-link.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { email, redirectTo } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('user_id, username')
      .eq('username', email.split('@')[0])
      .single()

    // Create or get auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { username: email.split('@')[0] }
    })

    if (authError && !authError.message.includes('already exists')) {
      throw authError
    }

    // Generate magic link (simplified - in production use proper email service)
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Store token in database
    await supabase.from('auth_tokens').insert({
      user_id: authUser?.id || existingUser?.user_id,
      token,
      type: 'magic_link',
      expires_at: expiresAt.toISOString()
    })

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: authUser?.id || existingUser?.user_id,
      action: 'magic_link_sent',
      entity_type: 'auth',
      metadata: { email }
    })

    const magicLink = `${redirectTo || 'https://earthguardians.org/auth/callback'}?token=${token}`

    return new Response(JSON.stringify({
      success: true,
      message: 'Magic link sent',
      debug_link: magicLink // Remove in production
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

#### `auth/verify-token.ts`
```typescript
// supabase/functions/auth/verify-token.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { token } = await req.json()

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify token
    const { data: tokenData, error: tokenError } = await supabase
      .from('auth_tokens')
      .select('*, profiles!user_id(*)')
      .eq('token', token)
      .eq('type', 'magic_link')
      .single()

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check expiration
    if (new Date(tokenData.expires_at) < new Date()) {
      await supabase.from('auth_tokens').update({ status: 'expired' }).eq('id', tokenData.id)
      return new Response(JSON.stringify({ error: 'Token has expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Delete used token
    await supabase.from('auth_tokens').delete().eq('id', tokenData.id)

    // Create session
    const { data: session } = await supabase.auth.admin.generateLink({
      type: 'magic_link',
      email: tokenData.profiles?.email || tokenData.user_id
    })

    return new Response(JSON.stringify({
      success: true,
      user: tokenData.profiles,
      session: session
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### 2. P2P Signaling Edge Functions

#### `p2p/relay-signal.ts`
```typescript
// supabase/functions/p2p/relay-signal.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { to_peer_id, signal_type, payload } = await req.json()

    // Validate signal type
    const validTypes = ['offer', 'answer', 'ice-candidate', 'leave']
    if (!validTypes.includes(signal_type)) {
      return new Response(JSON.stringify({ error: 'Invalid signal type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Store signal for relay
    const { data: signal, error } = await supabase
      .from('p2p_signaling')
      .insert({
        from_peer_id: user.id,
        to_peer_id,
        signal_type,
        payload
      })
      .select()
      .single()

    if (error) throw error

    // Get receiver's online status
    const { data: receiver } = await supabase
      .from('p2p_peers')
      .select('is_online')
      .eq('user_id', to_peer_id)
      .single()

    // If receiver is online, trigger realtime notification
    if (receiver?.is_online) {
      await supabase.channel('p2p-signals')
        .send({
          type: 'broadcast',
          event: 'signal',
          payload: { signal }
        })
    }

    return new Response(JSON.stringify({
      success: true,
      signal_id: signal.id,
      delivered: receiver?.is_online || false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

#### `p2p/register-peer.ts`
```typescript
// supabase/functions/p2p/register-peer.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { peer_id, public_key, connection_info } = await req.json()

    // Upsert peer record
    const { data: peer, error } = await supabase
      .from('p2p_peers')
      .upsert({
        user_id: user.id,
        peer_id,
        public_key,
        connection_info,
        is_online: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) throw error

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'peer_registered',
      entity_type: 'p2p_peer',
      entity_id: peer.id
    })

    // Get connected peers
    const { data: connectedPeers } = await supabase
      .from('p2p_peers')
      .select('user_id, peer_id, public_key')
      .eq('is_online', true)
      .neq('user_id', user.id)
      .limit(20)

    return new Response(JSON.stringify({
      success: true,
      peer_id: peer.peer_id,
      connected_peers: connectedPeers || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### 3. Project Management Edge Functions

#### `projects/create.ts`
```typescript
// supabase/functions/projects/create.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { name, description, crew_id, visibility, start_date, end_date, tags } = await req.json()

    if (!name) {
      return new Response(JSON.stringify({ error: 'Project name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create project
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name,
        description,
        crew_id,
        visibility: visibility || 'private',
        start_date,
        end_date,
        tags: tags || [],
        status: 'planning',
        created_by: user.id
      })
      .select(`
        *,
        creator:profiles!created_by(id, username, display_name, avatar_url)
      `)
      .single()

    if (error) throw error

    // Log activity
    await supabase.from('project_activities').insert({
      project_id: project.id,
      user_id: user.id,
      action: 'created',
      entity_type: 'project',
      entity_id: project.id,
      new_data: { name, description }
    })

    return new Response(JSON.stringify({
      success: true,
      project
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

#### `projects/list.ts`
```typescript
// supabase/functions/projects/list.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(req.url)
    const crew_id = url.searchParams.get('crew_id')
    const status = url.searchParams.get('status')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Build query for projects the user has access to
    let query = supabase
      .from('projects')
      .select(`
        *,
        creator:profiles!created_by(id, username, display_name, avatar_url),
        crew:crews(id, name, slug),
        tasks(count),
        task_summary:tasks(status, count)
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (crew_id) {
      query = query.eq('crew_id', crew_id)
    }

    if (status) {
      query = query.eq('status', status)
    }

    // Filter by user's crew membership
    const { data: userCrews } = await supabase
      .from('crew_members')
      .select('crew_id')
      .eq('user_id', user.id)

    const crewIds = userCrews?.map(c => c.crew_id) || []
    
    if (crewIds.length > 0) {
      query = query.or(`crew_id.in.(${crewIds.join(',')}),created_by.eq.${user.id}`)
    } else {
      query = query.eq('created_by', user.id)
    }

    const { data: projects, error, count } = await query

    if (error) throw error

    return new Response(JSON.stringify({
      projects,
      total: count,
      limit,
      offset
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### 4. Task Management Edge Functions

#### `tasks/create.ts`
```typescript
// supabase/functions/tasks/create.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { project_id, title, description, assignees, due_date, priority, tags, dependencies } = await req.json()

    if (!project_id || !title) {
      return new Response(JSON.stringify({ error: 'Project ID and title are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify project access
    const { data: project } = await supabase
      .from('projects')
      .select('id, crew_id')
      .eq('id', project_id)
      .single()

    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get max position
    const { data: lastTask } = await supabase
      .from('tasks')
      .select('position')
      .eq('project_id', project_id)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const position = (lastTask?.position || 0) + 1

    // Create task
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        project_id,
        title,
        description,
        assignees: assignees || [],
        due_date,
        priority: priority || 'medium',
        tags: tags || [],
        dependencies: dependencies || [],
        position,
        status: 'todo'
      })
      .select(`
        *,
        assignees_list:profiles!tasks_assignees_fkey(id, username, display_name, avatar_url)
      `)
      .single()

    if (error) throw error

    // Send notifications to assignees
    if (assignees && assignees.length > 0) {
      const notifications = assignees.map(assigneeId => ({
        user_id: assigneeId,
        title: 'New task assigned',
        body: `You have been assigned to: ${title}`,
        data: { task_id: task.id, project_id }
      }))

      await supabase.from('notifications').insert(notifications)
    }

    // Log activity
    await supabase.from('project_activities').insert({
      project_id,
      user_id: user.id,
      action: 'task_created',
      entity_type: 'task',
      entity_id: task.id,
      new_data: { title }
    })

    return new Response(JSON.stringify({
      success: true,
      task
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

#### `tasks/update.ts`
```typescript
// supabase/functions/tasks/update.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(req.url)
    const taskId = url.pathname.split('/').pop()

    if (!taskId) {
      return new Response(JSON.stringify({ error: 'Task ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const updates = await req.json()

    // Get old task for comparison
    const { data: oldTask } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (!oldTask) {
      return new Response(JSON.stringify({ error: 'Task not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Handle status change to 'done'
    if (updates.status === 'done' && oldTask.status !== 'done') {
      updates.completed_at = new Date().toISOString()
    }

    // Update task
    const { data: task, error } = await supabase
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select(`
        *,
        assignees_list:profiles!tasks_assignees_fkey(id, username, display_name, avatar_url)
      `)
      .single()

    if (error) throw error

    // Notify about status change
    if (updates.status && updates.status !== oldTask.status) {
      const assignees = oldTask.assignees || []
      const notifications = assignees
        .filter(id => id !== user.id)
        .map(assigneeId => ({
          user_id: assigneeId,
          title: 'Task status updated',
          body: `Task "${oldTask.title}" is now ${updates.status}`,
          data: { task_id: task.id }
        }))

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications)
      }
    }

    // Log activity
    await supabase.from('project_activities').insert({
      project_id: task.project_id,
      user_id: user.id,
      action: 'task_updated',
      entity_type: 'task',
      entity_id: task.id,
      old_data: oldTask,
      new_data: task
    })

    return new Response(JSON.stringify({
      success: true,
      task
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### 5. Notification Edge Functions

#### `notifications/send.ts`
```typescript
// supabase/functions/notifications/send.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { recipient_ids, title, body, type, data, channel } = await req.json()

    if (!recipient_ids || !title) {
      return new Response(JSON.stringify({ error: 'Recipients and title are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get notification preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .in('user_id', recipient_ids)

    // Create notifications based on preferences
    const notifications = []
    
    for (const recipientId of recipient_ids) {
      const pref = prefs?.find(p => p.user_id === recipientId)
      
      // Check if channel is enabled
      const channelKey = `${channel || 'in_app'}_on_${type || 'general'}`
      const enabled = pref?.[channelKey] !== false // Default to true

      if (enabled) {
        notifications.push({
          user_id: recipientId,
          title,
          body,
          type: type || 'general',
          data: data || {},
          channel: channel || 'in_app',
          read: false,
          created_at: new Date().toISOString()
        })
      }
    }

    const { data: created, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select()

    if (error) throw error

    // Trigger realtime for in-app notifications
    if (channel !== 'email' && channel !== 'push') {
      for (const notification of created || []) {
        await supabase.channel(`notifications-${notification.user_id}`)
          .send({
            type: 'broadcast',
            event: 'new_notification',
            payload: notification
          })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      notifications_created: created?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### 6. Storage & File Processing Edge Functions

#### `storage/upload.ts`
```typescript
// supabase/functions/storage/upload.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const bucket = formData.get('bucket') as string || 'assets'
    const folder = formData.get('folder') as string || ''

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Generate unique filename
    const ext = file.name.split('.').pop()
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const fileName = `${timestamp}-${randomStr}.${ext}`
    const path = folder ? `${folder}/${fileName}` : fileName

    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, uint8Array, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    // Create metadata record
    const { data: metadata, error: metaError } = await supabase
      .from('storage_metadata')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: path,
        bucket,
        compression_used: false // Could add compression logic here
      })
      .select()
      .single()

    if (metaError) console.error('Failed to create metadata:', metaError)

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'file_uploaded',
      entity_type: 'storage',
      entity_id: metadata?.id,
      metadata: { file_name: file.name, size: file.size }
    })

    return new Response(JSON.stringify({
      success: true,
      path,
      url: urlData.publicUrl,
      metadata
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### 7. Search Edge Function

#### `search/all.ts`
```typescript
// supabase/functions/search/all.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(req.url)
    const query = url.searchParams.get('q')
    const type = url.searchParams.get('type') // 'projects', 'tasks', 'documents', 'users', 'all'
    const limit = parseInt(url.searchParams.get('limit') || '10')

    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ error: 'Query must be at least 2 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const results: any = { query }
    const searchPattern = `%${query}%`

    // Search projects
    if (!type || type === 'projects' || type === 'all') {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name, description, status, created_at')
        .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .limit(limit)
      
      results.projects = projects || []
    }

    // Search tasks
    if (!type || type === 'tasks' || type === 'all') {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, description, status, project_id')
        .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
        .limit(limit)
      
      results.tasks = tasks || []
    }

    // Search documents
    if (!type || type === 'documents' || type === 'all') {
      const { data: documents } = await supabase
        .from('documents')
        .select('id, title, doc_type, created_at')
        .ilike('title', searchPattern)
        .limit(limit)
      
      results.documents = documents || []
    }

    // Search users
    if (!type || type === 'users' || type === 'all') {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .or(`username.ilike.${searchPattern},display_name.ilike.${searchPattern}`)
        .limit(limit)
      
      results.users = users || []
    }

    // Log search activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'search',
      entity_type: 'search',
      metadata: { query, type, result_count: Object.values(results).flat().length }
    })

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### 8. Profile & User Management Edge Functions

#### `profile/update.ts`
```typescript
// supabase/functions/profile/update.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const updates = await req.json()

    // Validate username uniqueness
    if (updates.username) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', updates.username)
        .neq('user_id', user.id)
        .single()

      if (existing) {
        return new Response(JSON.stringify({ error: 'Username already taken' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // Update profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action: 'profile_updated',
      entity_type: 'profile',
      entity_id: profile.id
    })

    return new Response(JSON.stringify({
      success: true,
      profile
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

#### `profile/get.ts`
```typescript
// supabase/functions/profile/get.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const { data: { user } } = await supabase.auth.getUser(authHeader)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const url = new URL(req.url)
    const targetUserId = url.searchParams.get('user_id') || user.id

    // Get profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        *,
        notification_preferences(*)
      `)
      .eq('user_id', targetUserId)
      .single()

    if (error) throw error

    // Get user stats
    const { count: projectsCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', targetUserId)

    const { count: tasksCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .contains('assignees', [targetUserId])

    const { count: crewCount } = await supabase
      .from('crew_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId)

    return new Response(JSON.stringify({
      profile: {
        ...profile,
        stats: {
          projects: projectsCount || 0,
          tasks: tasksCount || 0,
          crews: crewCount || 0
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

---

## 🎨 Frontend Components

### Required Vue Components

| Component | Path | Description |
|-----------|------|-------------|
| `AppHeader.vue` | `apps/web/src/components/AppHeader.vue` | Navigation header with auth state |
| `AppSidebar.vue` | `apps/web/src/components/AppSidebar.vue` | Sidebar navigation (mobile) |
| `AuthModal.vue` | `apps/web/src/components/AuthModal.vue` | Login/Register modal |
| `ProjectCard.vue` | `apps/web/src/components/ProjectCard.vue` | Project card display |
| `TaskCard.vue` | `apps/web/src/components/TaskCard.vue` | Task item display |
| `UserAvatar.vue` | `apps/web/src/components/UserAvatar.vue` | User avatar with status |
| `NotificationBell.vue` | `apps/web/src/components/NotificationBell.vue` | Notification dropdown |
| `SearchModal.vue` | `apps/web/src/components/SearchModal.vue` | Global search modal |
| `ThemeSwitcher.vue` | `apps/web/src/components/ThemeSwitcher.vue` | Theme toggle component |
| `P2PStatus.vue` | `apps/web/src/components/P2PStatus.vue` | P2P connection status |
| `WasmStatus.vue` | `apps/web/src/components/WasmStatus.vue` | WASM loading status |

### Required Views/Pages

| View | Path | Route | Description |
|------|------|-------|-------------|
| `HomeView.vue` | `apps/web/src/views/HomeView.vue` | `/` | Landing/Dashboard |
| `ProjectsView.vue` | `apps/web/src/views/ProjectsView.vue` | `/projects` | Projects list |
| `ProjectDetailView.vue` | `apps/web/src/views/ProjectDetailView.vue` | `/projects/:id` | Project details |
| `TasksView.vue` | `apps/web/src/views/TasksView.vue` | `/tasks` | Tasks board |
| `DocsView.vue` | `apps/web/src/views/DocsView.vue` | `/docs` | Documents |
| `EmailView.vue` | `apps/web/src/views/EmailView.vue` | `/email` | Email inbox |
| `SettingsView.vue` | `apps/web/src/views/SettingsView.vue` | `/settings` | User settings |
| `ProfileView.vue` | `apps/web/src/views/ProfileView.vue` | `/profile` | User profile |
| `P2PView.vue` | `apps/web/src/views/P2PView.vue` | `/p2p` | P2P network view |
| `AuthCallbackView.vue` | `apps/web/src/views/AuthCallbackView.vue` | `/auth/callback` | Auth callback handler |

### Required Composables

| Composable | Path | Description |
|------------|------|-------------|
| `useAuth.ts` | `apps/web/src/composables/useAuth.ts` | Authentication state |
| `useSupabase.ts` | `apps/web/src/composables/useSupabase.ts` | Supabase client |
| `useProjects.ts` | `apps/web/src/composables/useProjects.ts` | Projects CRUD |
| `useTasks.ts` | `apps/web/src/composables/useTasks.ts` | Tasks CRUD |
| `useNotifications.ts` | `apps/web/src/composables/useNotifications.ts` | Notifications |
| `useP2P.ts` | `apps/web/src/composables/useP2P.ts` | P2P connection |
| `useWasm.ts` | `apps/web/src/composables/useWasm.ts` | WASM module |
| `useTheme.ts` | `apps/web/src/composables/useTheme.ts` | Theme management |
| `useRealtime.ts` | `apps/web/src/composables/useRealtime.ts` | Supabase realtime |

### Required Pinia Stores

| Store | Path | Description |
|-------|------|-------------|
| `auth.ts` | `apps/web/src/stores/auth.ts` | User authentication state |
| `projects.ts` | `apps/web/src/stores/projects.ts` | Projects state |
| `tasks.ts` | `apps/web/src/stores/tasks.ts` | Tasks state |
| `notifications.ts` | `apps/web/src/stores/notifications.ts` | Notifications state |
| `p2p.ts` | `apps/web/src/stores/p2p.ts` | P2P state |
| `ui.ts` | `apps/web/src/stores/ui.ts` | UI state (modals, theme) |

---

## 🔗 Supabase Integration

### 1. Supabase Client Setup

```typescript
// apps/web/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: {
      getItem: (key) => {
        try {
          return localStorage.getItem(key)
        } catch {
          return null
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, value)
        } catch {
          console.error('Failed to save to localStorage')
        }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key)
        } catch {
          console.error('Failed to remove from localStorage')
        }
      }
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

export default supabase
```

### 2. Supabase Client Plugin

```typescript
// apps/web/src/plugins/supabase.client.ts
import { inject } from 'vue'
import { supabase } from '../lib/supabase'

export default {
  install: (app: any) => {
    app.config.globalProperties.$supabase = supabase
    app.provide('supabase', supabase)
  }
}

// Usage in components: const supabase = inject('supabase')
```

### 3. Router Configuration

```typescript
// apps/web/src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('../views/ProjectsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/projects/:id',
    name: 'ProjectDetail',
    component: () => import('../views/ProjectDetailView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('../views/TasksView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/docs',
    name: 'Docs',
    component: () => import('../views/DocsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/email',
    name: 'Email',
    component: () => import('../views/EmailView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/p2p',
    name: 'P2P',
    component: () => import('../views/P2PView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: () => import('../views/AuthCallbackView.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth && !session) {
    next('/?login=true')
  } else {
    next()
  }
})

export default router
```

### 4. Main.ts Updates

```typescript
// apps/web/src/main.ts (updated)
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import supabasePlugin from './plugins/supabase.client'
import './assets/css/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(supabasePlugin)

// Initialize auth state
import { useAuthStore } from './stores/auth'
const authStore = useAuthStore()
authStore.initialize()

app.mount('#app')
```

---

## 🌐 P2P Networking

### Required P2P Files

| File | Path | Description |
|------|------|-------------|
| `signaling.ts` | `src/p2p/signaling.ts` | Supabase-based signaling |
| `peer-connection.ts` | `src/p2p/peer-connection.ts` | WebRTC connection management |
| `data-channel.ts` | `src/p2p/data-channel.ts` | Data channel handling |
| `file-transfer.ts` | `src/p2p/file-transfer.ts` | P2P file transfer |
| `relay.ts` | `src/p2p/relay.ts` | TURN relay fallback |

### P2P Signaling Implementation

```typescript
// src/p2p/signaling.ts
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export class SignalingService {
  private channel: RealtimeChannel | null = null
  private handlers: Map<string, ((data: any) => void)[]> = new Map()

  async connect(userId: string): Promise<void> {
    // Join signaling channel
    this.channel = supabase.channel(`p2p-signaling-${userId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: userId }
      }
    })

    // Handle incoming signals
    this.channel.on('broadcast', { event: 'signal' }, (payload) => {
      const { signal_type, from_peer_id, payload: signal_data } = payload.payload
      this.emit(signal_type, { from: from_peer_id, data: signal_data })
    })

    // Handle presence
    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel?.presenceState() || {}
      this.emit('peers-updated', Object.keys(state))
    })

    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel?.track({ user_id: userId, online_at: new Date().toISOString() })
      }
    })
  }

  async sendSignal(toPeerId: string, signalType: string, payload: any): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Send via Supabase Realtime
    await this.channel?.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        from_peer_id: user.id,
        to_peer_id: toPeerId,
        signal_type: signalType,
        payload
      }
    })

    // Also store in database for offline delivery
    await supabase.from('p2p_signaling').insert({
      from_peer_id: user.id,
      to_peer_id: toPeerId,
      signal_type: signalType,
      payload
    })
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event)!.push(handler)
  }

  private emit(event: string, data: any): void {
    this.handlers.get(event)?.forEach(handler => handler(data))
  }

  async disconnect(): Promise<void> {
    await this.channel?.unsubscribe()
    this.channel = null
  }
}

export const signalingService = new SignalingService()
```

---

## 🔐 Authentication & Security

### 1. Auth Store

```typescript
// apps/web/src/stores/auth.ts
import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    session: null,
    loading: false,
    initialized: false
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    userProfile: (state) => state.user?.user_metadata
  },

  actions: {
    async initialize() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        this.session = session
        this.user = session?.user ?? null

        // Listen for auth changes
        supabase.auth.onAuthStateChange((event, session) => {
          this.session = session
          this.user = session?.user ?? null
        })

        this.initialized = true
      } catch (error) {
        console.error('Auth initialization failed:', error)
      }
    },

    async signInWithEmail(email: string, redirectTo?: string) {
      this.loading = true
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: redirectTo || `${window.location.origin}/auth/callback`
          }
        })
        if (error) throw error
        return { success: true }
      } catch (error) {
        return { error: error.message }
      } finally {
        this.loading = false
      }
    },

    async signOut() {
      this.loading = true
      try {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        this.user = null
        this.session = null
      } catch (error) {
        console.error('Sign out failed:', error)
      } finally {
        this.loading = false
      }
    },

    async updateProfile(updates: Record<string, any>) {
      if (!this.user) return { error: 'Not authenticated' }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', this.user.id)

      return { error }
    }
  }
})
```

### 2. RLS Policies Summary

| Table | Policy | Description |
|-------|--------|-------------|
| `profiles` | Select: Public, Update: Owner | View all profiles, edit own |
| `crews` | Select: Members, All: Leaders | View crew, full access for leaders |
| `projects` | Select: Crew members, All: Creator | View project, edit creator |
| `tasks` | Select: Assignees, Update: Assignees | View tasks, edit assigned tasks |
| `documents` | Select: Creator/Shared, Update: Creator | View/edit based on access |
| `notifications` | Select/Update: Owner | Only see own notifications |
| `email_messages` | Select: Sender/Recipient | View own messages |
| `p2p_peers` | All: Owner | Manage own peer record |
| `p2p_signaling` | Select: Participants, Insert: Auth users | Signal between peers |
| `storage_metadata` | All: Owner | Manage own files |
| `activity_logs` | Select: Own records | View own activity |
| `team_invites` | Select/Update: Crew leaders | Manage invites |

---

## 🚀 Features & Enhancements

### 1. Real-time Subscriptions

```typescript
// apps/web/src/composables/useRealtime.ts
import { onMounted, onUnmounted, ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useNotificationsStore } from '../stores/notifications'
import { useTasksStore } from '../stores/tasks'

export function useRealtime(userId: string) {
  const notificationsStore = useNotificationsStore()
  const tasksStore = useTasksStore()
  
  let notificationsChannel: any = null
  let tasksChannel: any = null

  const connect = () => {
    // Notifications subscription
    notificationsChannel = supabase
      .channel(`notifications-${userId}`)
      .on('broadcast', { event: 'new_notification' }, (payload) => {
        notificationsStore.add(payload.payload)
      })
      .subscribe()

    // Tasks subscription
    tasksChannel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks'
      }, (payload) => {
        tasksStore.handleRealtimeChange(payload)
      })
      .subscribe()
  }

  const disconnect = () => {
    notificationsChannel?.unsubscribe()
    tasksChannel?.unsubscribe()
  }

  onMounted(() => {
    if (userId) connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  return { connect, disconnect }
}
```

### 2. Offline Support (Service Worker)

```typescript
// apps/web/public/sw.js
const CACHE_NAME = 'earth-guardians-v1'
const OFFLINE_URL = '/offline.html'

const assetsToCache = [
  '/',
  '/index.html',
  '/src/main.ts',
  '/src/assets/css/main.css'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache)
    })
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        return response || caches.match(OFFLINE_URL)
      })
    })
  )
})
```

### 3. WASM Integration Hook

```typescript
// apps/web/src/composables/useWasm.ts
import { ref, onMounted } from 'vue'
import init, { Compressor, Hasher, P2PUtils } from '@earth-guardians/shared'

interface WasmModule {
  Compressor: typeof Compressor
  Hasher: typeof Hasher
  P2PUtils: typeof P2PUtils
}

export function useWasm() {
  const isReady = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const wasmModule = ref<WasmModule | null>(null)

  const initialize = async () => {
    if (isReady.value || isLoading.value) return

    isLoading.value = true
    try {
      await init()
      wasmModule.value = { Compressor, Hasher, P2PUtils }
      isReady.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to initialize WASM'
      console.warn('WASM initialization failed, using fallbacks:', e)
      // Set fallbacks
      wasmModule.value = null
      isReady.value = true
    } finally {
      isLoading.value = false
    }
  }

  const compress = (data: Uint8Array): Uint8Array => {
    if (wasmModule.value) {
      const compressor = new wasmModule.value.Compressor()
      return compressor.compress(data)
    }
    // Fallback: return as-is
    return data
  }

  const hash = (data: Uint8Array): string => {
    if (wasmModule.value) {
      const hasher = new wasmModule.value.Hasher()
      hasher.update(data)
      return hasher.finish()
    }
    // Fallback: simple hash
    let h = 0
    for (let i = 0; i < data.length; i++) {
      h = ((h << 5) - h + data[i]) | 0
    }
    return Math.abs(h).toString(16)
  }

  onMounted(() => {
    initialize()
  })

  return {
    isReady,
    isLoading,
    error,
    initialize,
    compress,
    hash
  }
}
```

---

## 🏗️ Infrastructure & Deploy

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build WASM
        run: pnpm build:wasm

      - name: Build Web App
        run: pnpm build:web
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./apps/web/dist
          publish_branch: gh-pages

  supabase-deploy:
    runs-on: ubuntu-latest
    needs: build-and-deploy
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy Edge Functions
        run: |
          supabase login --token ${{ secrets.SUPABASE_SERVICE_KEY }}
          supabase functions deploy --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
```

### Environment Configuration

```bash
# .env.production
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://your-project.supabase.co/functions/v1
```

---

## 📊 Implementation Priority

| Priority | Task | Category | Estimated Time |
|----------|------|----------|----------------|
| 🔴 P0 | Fix duplicate P2P manager imports | Bug Fix | 1 hour |
| 🔴 P0 | Setup Supabase client in web app | Integration | 2 hours |
| 🔴 P0 | Implement Vue Router | Frontend | 2 hours |
| 🔴 P0 | Create Pinia stores | Frontend | 4 hours |
| 🟡 P1 | Add migrations 002-006 | Database | 4 hours |
| 🟡 P1 | Create all edge functions | Backend | 8 hours |
| 🟡 P1 | Build required views | Frontend | 8 hours |
| 🟡 P1 | Build required components | Frontend | 6 hours |
| 🟡 P1 | Implement composables | Frontend | 4 hours |
| 🟢 P2 | P2P signaling with Supabase | P2P | 6 hours |
| 🟢 P2 | Real-time subscriptions | Integration | 4 hours |
| 🟢 P2 | GitHub Actions deployment | DevOps | 2 hours |
| 🟢 P2 | Service worker for offline | Feature | 3 hours |

---

## ✅ Checklist

- [ ] Fix P2P manager import conflicts
- [ ] Setup Supabase client with proper error handling
- [ ] Implement Vue Router with auth guards
- [ ] Create all Pinia stores
- [ ] Run database migrations 002-006
- [ ] Deploy all edge functions
- [ ] Build all required views
- [ ] Build all required components
- [ ] Implement all composables
- [ ] Setup P2P signaling via Supabase Realtime
- [ ] Configure GitHub Actions for deployment
- [ ] Test end-to-end functionality
- [ ] Verify security policies
- [ ] Document API endpoints

---

*Last Updated: 2024-12-19*
*Version: 1.0.0*