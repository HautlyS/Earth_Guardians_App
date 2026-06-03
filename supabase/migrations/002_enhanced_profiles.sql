-- Earth Guardians - Migration 002: Enhanced Profiles & Settings
-- Adds extended profile fields, notification preferences, user sessions, and activity logs

-- Add extended profile fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_data TEXT;
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
    email_on_system BOOLEAN DEFAULT false,
    push_on_mention BOOLEAN DEFAULT true,
    push_on_task_assign BOOLEAN DEFAULT true,
    push_on_project_update BOOLEAN DEFAULT false,
    push_on_message BOOLEAN DEFAULT true,
    push_on_system BOOLEAN DEFAULT false,
    in_app_on_mention BOOLEAN DEFAULT true,
    in_app_on_task_assign BOOLEAN DEFAULT true,
    in_app_on_project_update BOOLEAN DEFAULT true,
    in_app_on_message BOOLEAN DEFAULT true,
    in_app_on_system BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User sessions for multi-device support
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
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

-- Auth tokens for magic link and other auth methods
CREATE TABLE IF NOT EXISTS auth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'magic_link',
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen_at DESC) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);

-- Function to update last seen timestamp
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles 
    SET last_seen_at = NOW(), 
        is_online = true 
    WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update last seen on user activity
CREATE TRIGGER on_user_activity
AFTER INSERT ON user_sessions
FOR EACH ROW EXECUTE FUNCTION update_last_seen();

-- Function to set offline status (called periodically)
CREATE OR REPLACE FUNCTION set_offline_users()
RETURNS void AS $$
BEGIN
    UPDATE profiles
    SET is_online = false
    WHERE last_seen_at < NOW() - INTERVAL '5 minutes'
    AND is_online = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own notification preferences
CREATE POLICY "Users can view own notification preferences" ON notification_preferences
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notification preferences" ON notification_preferences
    FOR ALL USING (user_id = auth.uid());

-- Users can manage their own sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions" ON user_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions" ON user_sessions
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions" ON user_sessions
    FOR DELETE USING (user_id = auth.uid());

-- Users can view and insert their own activity logs
CREATE POLICY "Users can view own activity logs" ON activity_logs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own activity logs" ON activity_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can manage their own auth tokens
CREATE POLICY "Users can view own auth tokens" ON auth_tokens
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own auth tokens" ON auth_tokens
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own auth tokens" ON auth_tokens
    FOR UPDATE USING (user_id = auth.uid());

-- Comments
COMMENT ON TABLE notification_preferences IS 'User notification settings for email, push, and in-app notifications';
COMMENT ON TABLE user_sessions IS 'Multi-device session tracking for security and presence';
COMMENT ON TABLE activity_logs IS 'User activity audit trail for analytics and security';
COMMENT ON TABLE auth_tokens IS 'Magic link and other authentication token storage';