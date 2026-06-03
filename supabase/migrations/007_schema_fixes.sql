-- Earth Guardians - Migration 007: Schema Fixes (P0 round 5)
-- - Add email_messages columns referenced by edge functions
-- - Add profiles INSERT/UPDATE policies
-- - Add crews INSERT/UPDATE/DELETE policies
-- - Make auth_tokens.user_id nullable (or split)
-- - Fix task_dependencies broken policy
-- - Add owner-based policies for projects/tasks
-- - Add last_seen heartbeat trigger
-- - Make handle_new_user username collision-safe
-- - Add is_public to projects

BEGIN;

-- =========================================================
-- 1) email_messages: add columns referenced by edge functions
-- =========================================================
ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS preview TEXT,
  ADD COLUMN IF NOT EXISTS has_attachments BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS folder VARCHAR(20) NOT NULL DEFAULT 'inbox'
    CHECK (folder IN ('inbox','sent','drafts','archive','trash','starred')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_email_messages_folder ON email_messages(folder);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender_created ON email_messages(sender_id, created_at DESC);

-- =========================================================
-- 2) profiles: INSERT and UPDATE policies (P0-002)
-- =========================================================
DROP POLICY IF EXISTS "Profiles insert own row" ON profiles;
CREATE POLICY "Profiles insert own row" ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Profiles update own row" ON profiles;
CREATE POLICY "Profiles update own row" ON profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================================================
-- 3) crews: INSERT/UPDATE/DELETE policies (P0-003)
-- =========================================================
DROP POLICY IF EXISTS "Crews insertable by authenticated" ON crews;
CREATE POLICY "Crews insertable by authenticated" ON crews
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Crews updatable by creator" ON crews;
CREATE POLICY "Crews updatable by creator" ON crews
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Crews deletable by creator" ON crews;
CREATE POLICY "Crews deletable by creator" ON crews
  FOR DELETE USING (created_by = auth.uid());

-- Crew creators can add themselves as members
DROP POLICY IF EXISTS "Crew members self-insert for new crews" ON crew_members;
CREATE POLICY "Crew members self-insert for new crews" ON crew_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM crews WHERE id = crew_id AND created_by = auth.uid())
  );

-- =========================================================
-- 4) auth_tokens: split into pre_auth_tokens for magic-link flow (P0-004, P0-133)
-- =========================================================
-- pre_auth_tokens: tokens for users who haven't signed in yet (e.g. magic-link)
CREATE TABLE IF NOT EXISTS pre_auth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'magic_link',
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pre_auth_tokens_email ON pre_auth_tokens(email);
CREATE INDEX IF NOT EXISTS idx_pre_auth_tokens_expires ON pre_auth_tokens(expires_at);
ALTER TABLE pre_auth_tokens ENABLE ROW LEVEL SECURITY;

-- Service role only — no client access. We use this for the magic-link fallback
-- (which is now deprecated in favor of Supabase OTP, see edge function fix).
DROP POLICY IF EXISTS "No client access to pre_auth_tokens" ON pre_auth_tokens;
CREATE POLICY "No client access to pre_auth_tokens" ON pre_auth_tokens
  FOR ALL USING (false) WITH CHECK (false);

-- =========================================================
-- 5) task_dependencies: rewrite the broken policy (P0-005)
-- =========================================================
DROP POLICY IF EXISTS "Task dependencies manageable by task creators" ON task_dependencies;
DROP POLICY IF EXISTS "Task dependencies viewable by crew members" ON task_dependencies;

CREATE POLICY "Task dependencies viewable by participants" ON task_dependencies
  FOR SELECT USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE created_by = auth.uid()
         OR auth.uid() = ANY(assignees)
         OR project_id IN (
           SELECT id FROM projects
           WHERE created_by = auth.uid()
              OR crew_id IN (SELECT crew_id FROM crew_members WHERE user_id = auth.uid())
         )
    )
  );

CREATE POLICY "Task dependencies insertable by task creator/assignee" ON task_dependencies
  FOR INSERT WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE created_by = auth.uid()
         OR auth.uid() = ANY(assignees)
    )
  );

CREATE POLICY "Task dependencies deletable by task creator" ON task_dependencies
  FOR DELETE USING (
    task_id IN (SELECT id FROM tasks WHERE created_by = auth.uid())
  );

-- =========================================================
-- 6) projects: owner-based policies (P0-063, P0-082)
-- =========================================================
DROP POLICY IF EXISTS "Projects insertable by owner" ON projects;
CREATE POLICY "Projects insertable by owner" ON projects
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Projects updatable by owner or crew" ON projects;
CREATE POLICY "Projects updatable by owner or crew" ON projects
  FOR UPDATE USING (
    created_by = auth.uid()
    OR crew_id IN (SELECT crew_id FROM crew_members WHERE user_id = auth.uid())
  ) WITH CHECK (
    created_by = auth.uid()
    OR crew_id IN (SELECT crew_id FROM crew_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Projects deletable by owner" ON projects;
CREATE POLICY "Projects deletable by owner" ON projects
  FOR DELETE USING (created_by = auth.uid());

-- =========================================================
-- 7) tasks: project-member based policies (P0-082)
-- =========================================================
DROP POLICY IF EXISTS "Tasks insertable by project member" ON tasks;
CREATE POLICY "Tasks insertable by project member" ON tasks
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects
      WHERE created_by = auth.uid()
         OR crew_id IN (SELECT crew_id FROM crew_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Tasks updatable by creator, assignee, or project owner" ON tasks;
CREATE POLICY "Tasks updatable by creator, assignee, or project owner" ON tasks
  FOR UPDATE USING (
    created_by = auth.uid()
    OR auth.uid() = ANY(assignees)
    OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
  ) WITH CHECK (
    created_by = auth.uid()
    OR auth.uid() = ANY(assignees)
    OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Tasks deletable by creator or project owner" ON tasks;
CREATE POLICY "Tasks deletable by creator or project owner" ON tasks
  FOR DELETE USING (
    created_by = auth.uid()
    OR project_id IN (SELECT id FROM projects WHERE created_by = auth.uid())
  );

-- =========================================================
-- 8) documents: is_public column (idempotent — already at end of 005, but no-op here)
-- =========================================================
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_documents_creator ON documents(creator_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_public ON documents(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);

-- =========================================================
-- 9) documents: public SELECT policy (P0-103)
-- =========================================================
DROP POLICY IF EXISTS "Public documents viewable by anyone" ON documents;
CREATE POLICY "Public documents viewable by anyone" ON documents
  FOR SELECT USING (
    creator_id = auth.uid()
    OR is_public = true
    OR project_id IN (
      SELECT id FROM projects
      WHERE created_by = auth.uid()
         OR crew_id IN (SELECT crew_id FROM crew_members WHERE user_id = auth.uid())
    )
  );

-- =========================================================
-- 10) profiles: handle_new_user — collision-safe username (P0-039)
-- =========================================================
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
DECLARE
    base_username TEXT;
    candidate_username TEXT;
    attempt INTEGER := 0;
BEGIN
    base_username := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9_]', '', 'g'));
    IF length(base_username) = 0 THEN
        base_username := 'user';
    END IF;
    base_username := substring(base_username, 1, 24);
    candidate_username := base_username;

    -- Find a free username, up to 10 attempts before falling back to a uuid fragment
    WHILE EXISTS (SELECT 1 FROM profiles WHERE username = candidate_username) AND attempt < 10 LOOP
        attempt := attempt + 1;
        candidate_username := base_username || '_' || attempt::text;
    END LOOP;

    IF EXISTS (SELECT 1 FROM profiles WHERE username = candidate_username) THEN
        candidate_username := base_username || '_' || substring(NEW.id::text, 1, 8);
    END IF;

    INSERT INTO profiles (user_id, username, display_name)
    VALUES (NEW.id, candidate_username, split_part(NEW.email, '@', 1))
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists from 001; if it was dropped, recreate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =========================================================
-- 11) profiles last_seen: trigger on auth.sessions (P0-038)
-- =========================================================
-- supabase-auth populates auth.sessions on sign-in. A trigger there updates profiles.last_seen_at
-- and is_online. The user_sessions trigger in 002 is never fired (the table is never written to).
CREATE OR REPLACE FUNCTION touch_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles
    SET last_seen_at = NOW(), is_online = true
    WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_session_created ON auth.sessions;
CREATE TRIGGER on_auth_session_created
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION touch_last_seen();

-- Also handle session refresh: when a session is updated, mark user online.
CREATE OR REPLACE FUNCTION touch_last_seen_on_refresh()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles
    SET last_seen_at = NOW(), is_online = true
    WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_session_updated ON auth.sessions;
CREATE TRIGGER on_auth_session_updated
  AFTER UPDATE OF refreshed_at ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION touch_last_seen_on_refresh();

-- Periodic: mark stale users offline. Schedule via pg_cron in a follow-up migration
-- or call this from an edge function on a cron.
-- The 5-minute cutoff is identical to 002.

-- =========================================================
-- 12) notification_preferences: ensure the table also stores
--     email_enabled/push_enabled (used by SettingsView) (P0-081)
-- =========================================================
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS project_updates BOOLEAN DEFAULT true;

-- =========================================================
-- 13) profiles: ensure last_seen heartbeat path for the client (P0-038)
--     This is a SECURITY DEFINER RPC the client can call periodically.
-- =========================================================
CREATE OR REPLACE FUNCTION heartbeat_last_seen()
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET last_seen_at = NOW(), is_online = true
    WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================
-- 14) crews: staff/admin can see all crews (P0-083)
-- =========================================================
DROP POLICY IF EXISTS "Staff can view all crews" ON crews;
CREATE POLICY "Staff can view all crews" ON crews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('staff', 'regional_councilor')
    )
  );

DROP POLICY IF EXISTS "Staff can view all projects" ON projects;
CREATE POLICY "Staff can view all projects" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('staff', 'regional_councilor')
    )
    OR visibility = 'public'
    OR created_by = auth.uid()
    OR crew_id IN (SELECT crew_id FROM crew_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Staff can view all tasks" ON tasks;
CREATE POLICY "Staff can view all tasks" ON tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('staff', 'regional_councilor')
    )
    OR created_by = auth.uid()
    OR auth.uid() = ANY(assignees)
    OR project_id IN (
      SELECT id FROM projects
      WHERE created_by = auth.uid()
         OR crew_id IN (SELECT crew_id FROM crew_members WHERE user_id = auth.uid())
    )
  );

-- =========================================================
-- 15) documents: edit/delete by creator (P0-103)
-- =========================================================
DROP POLICY IF EXISTS "Documents updatable by creator" ON documents;
CREATE POLICY "Documents updatable by creator" ON documents
  FOR UPDATE USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Documents deletable by creator" ON documents;
CREATE POLICY "Documents deletable by creator" ON documents
  FOR DELETE USING (creator_id = auth.uid());

-- =========================================================
-- 16) check_permission: rename misleading function (P0-029)
--     The old function `check_permission(p_user_role, p_required_role)` is misleading
--     because it never actually checks auth.uid(). Add a `role_can()` that takes a role and
--     keep the legacy function as a thin alias.
-- =========================================================
CREATE OR REPLACE FUNCTION role_can(p_actor_role user_role, p_required_role user_role)
RETURNS BOOLEAN AS $$
DECLARE
    rank_value INTEGER;
    required_value INTEGER;
BEGIN
    rank_value := CASE p_actor_role
        WHEN 'staff' THEN 100
        WHEN 'regional_councilor' THEN 80
        WHEN 'crew_leader' THEN 60
        WHEN 'crew_member' THEN 40
        WHEN 'stakeholder' THEN 20
        WHEN 'partner' THEN 20
        ELSE 0
    END;
    required_value := CASE p_required_role
        WHEN 'staff' THEN 100
        WHEN 'regional_councilor' THEN 80
        WHEN 'crew_leader' THEN 60
        WHEN 'crew_member' THEN 40
        WHEN 'stakeholder' THEN 20
        WHEN 'partner' THEN 20
        ELSE 0
    END;
    RETURN rank_value >= required_value;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- The legacy function is now explicit about the actor role
CREATE OR REPLACE FUNCTION check_permission(p_actor_role user_role, p_required_role user_role)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN role_can(p_actor_role, p_required_role);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Authoritative check that ALSO verifies the caller is the actor
CREATE OR REPLACE FUNCTION current_user_can(p_required_role user_role)
RETURNS BOOLEAN AS $$
DECLARE
    actor_role user_role;
BEGIN
    SELECT role INTO actor_role FROM profiles WHERE user_id = auth.uid();
    IF actor_role IS NULL THEN
        RETURN false;
    END IF;
    RETURN role_can(actor_role, p_required_role);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMIT;
