-- Earth Guardians App - Seed Data
-- Version: 1.0.0
-- Description: Initial seed data for development and testing

-- ============================================================
-- SEED USERS (for development only - remove in production)
-- ============================================================

-- Create demo users using Supabase Auth
-- Note: In production, users would sign up through the auth system

-- Admin user
INSERT INTO profiles (id, user_id, username, display_name, role, bio)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'Admin User',
    'admin',
    'Earth Guardians Platform Administrator'
);

-- Staff user
INSERT INTO profiles (id, user_id, username, display_name, role, bio)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'staff',
    'Staff Member',
    'staff',
    'Earth Guardians Staff Coordinator'
);

-- Member user
INSERT INTO profiles (id, user_id, username, display_name, role, bio)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'member',
    'Team Member',
    'member',
    'Earth Guardians Team Member'
);

-- ============================================================
-- SEED TEAMS
-- ============================================================

INSERT INTO teams (id, name, slug, description, created_by)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    'Earth Guardians Core',
    'earth-guardians-core',
    'Core development team for Earth Guardians platform',
    '00000000-0000-0000-0000-000000000001'
);

INSERT INTO teams (id, name, slug, description, created_by)
VALUES (
    '10000000-0000-0000-0000-000000000002',
    'P2P Network Team',
    'p2p-network',
    'Team focused on decentralized P2P networking',
    '00000000-0000-0000-0000-000000000002'
);

-- ============================================================
-- SEED TEAM MEMBERS
-- ============================================================

INSERT INTO team_members (team_id, user_id, role, invited_by)
VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', NULL),
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'admin', '00000000-0000-0000-0000-000000000001'),
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'member', '00000000-0000-0000-0000-000000000001'),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'owner', NULL),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'staff', '00000000-0000-0000-0000-000000000002');

-- ============================================================
-- SEED PROJECTS
-- ============================================================

INSERT INTO projects (id, team_id, name, description, status, priority, created_by)
VALUES
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Platform v2.0', 'Next generation Earth Guardians platform with P2P integration', 'active', 'high', '00000000-0000-0000-0000-000000000001'),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Mobile App', 'Cross-platform mobile application', 'planning', 'medium', '00000000-0000-0000-0000-000000000002'),
    ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'P2P Network', 'Decentralized P2P networking layer', 'active', 'urgent', '00000000-0000-0000-0000-000000000002');

-- ============================================================
-- SEED PROJECT MEMBERS
-- ============================================================

INSERT INTO project_members (project_id, user_id, role, can_edit, can_delete)
VALUES
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin', true, true),
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'admin', true, true),
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'member', true, false),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'admin', true, true),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'member', false, false),
    ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'admin', true, true),
    ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'staff', true, false);

-- ============================================================
-- SEED TASKS
-- ============================================================

INSERT INTO tasks (id, project_id, title, description, status, priority, assignees, created_by)
VALUES
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Setup P2P Infrastructure', 'Implement WebRTC P2P manager with STUN servers', 'in_progress', 'high', ARRAY['00000000-0000-0000-0000-000000000002'], '00000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Database Schema Design', 'Create Supabase SQL migrations for all entities', 'done', 'medium', ARRAY['00000000-0000-0000-0000-000000000001'], '00000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Authentication System', 'Implement Supabase Auth with RLS policies', 'done', 'high', ARRAY['00000000-0000-0000-0000-000000000002'], '00000000-0000-0000-0000-000000000001'),
    ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'Team Management Module', 'Build team creation and member management', 'in_progress', 'medium', ARRAY['00000000-0000-0000-0000-000000000003'], '00000000-0000-0000-0000-000000000002'),
    ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'File Storage System', 'Integrate Supabase Storage with P2P sharing', 'todo', 'medium', ARRAY['00000000-0000-0000-0000-000000000003'], '00000000-0000-0000-0000-000000000002'),
    ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 'Quantum Encryption Layer', 'Implement quantum-inspired encryption for sensitive data', 'in_progress', 'urgent', ARRAY['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'], '00000000-0000-0000-0000-000000000002'),
    ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', 'STUN Server Integration', 'Connect to 50+ free STUN servers for NAT traversal', 'done', 'high', ARRAY['00000000-0000-0000-0000-000000000003'], '00000000-0000-0000-0000-000000000002');

-- ============================================================
-- SEED CONVERSATIONS
-- ============================================================

INSERT INTO conversations (id, type, name, created_by)
VALUES
    ('40000000-0000-0000-0000-000000000001', 'team', 'Earth Guardians Core Team', '00000000-0000-0000-0000-000000000001'),
    ('40000000-0000-0000-0000-000000000002', 'project', 'Platform v2.0 Chat', '00000000-0000-0000-0000-000000000001'),
    ('40000000-0000-0000-0000-000000000003', 'direct', NULL, '00000000-0000-0000-0000-000000000001');

-- ============================================================
-- SEED CONVERSATION PARTICIPANTS
-- ============================================================

INSERT INTO conversation_participants (conversation_id, user_id, role)
VALUES
    ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin'),
    ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'member'),
    ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'member'),
    ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin'),
    ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'admin'),
    ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'member'),
    ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'member');

-- ============================================================
-- SEED MESSAGES
-- ============================================================

INSERT INTO messages (id, conversation_id, sender_id, type, content)
VALUES
    ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'text', 'Welcome to Earth Guardians Core Team! 🚀'),
    ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'text', 'Thanks! Excited to be part of this project!'),
    ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'text', 'The P2P infrastructure looks great. Ready to help with the mobile app!'),
    ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'text', 'Platform v2.0 development has started!'),
    ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'text', 'P2P networking is coming along nicely'),
    ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'text', 'Hey! Quick sync needed on the P2P architecture'),
    ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'text', 'Sure! I have some updates on the STUN server integration');

-- Update last_message_at
UPDATE conversations SET last_message_at = NOW() WHERE id IN ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003');

-- ============================================================
-- SEED NOTIFICATIONS
-- ============================================================

INSERT INTO notifications (user_id, type, title, body, data)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'team_invite', 'Welcome to Earth Guardians Core', 'You have been added as an admin', '{"team_id":"10000000-0000-0000-0000-000000000001"}'),
    ('00000000-0000-0000-0000-000000000002', 'task_assigned', 'P2P Infrastructure Setup', 'You have been assigned to setup P2P infrastructure', '{"task_id":"30000000-0000-0000-0000-000000000001"}'),
    ('00000000-0000-0000-0000-000000000003', 'project_update', 'Platform v2.0 Started', 'The platform v2.0 project has been activated', '{"project_id":"20000000-0000-0000-0000-000000000001"}');

-- ============================================================
-- SEED P2P NODES (for testing)
-- ============================================================

INSERT INTO p2p_nodes (peer_id, public_key, ip_address, port, region, capabilities, status)
VALUES
    ('peer_core_001', 'pk_earth_guardians_core_001', '10.0.1.100', 8080, 'us-west', '["storage","relay","discovery"]', 'online'),
    ('peer_mobile_001', 'pk_earth_guardians_mobile_001', '10.0.2.100', 8080, 'us-east', '["storage","relay"]', 'online'),
    ('peer_backup_001', 'pk_earth_guardians_backup_001', '10.0.3.100', 8080, 'eu-central', '["storage","archive"]', 'offline');

-- ============================================================
-- SEED QUANTUM ENCRYPTION KEYS (test keys)
-- ============================================================

INSERT INTO encryption_keys (name, algorithm, key_type, metadata, created_by)
VALUES
    ('Primary Storage Key', 'quantum_hybrid_aes256', 'quantum_hybrid', '{"algorithm":"AES-256-GCM","mode":"quantum_resistant"}', '00000000-0000-0000-0000-000000000001'),
    ('P2P Network Key', 'quantum_hybrid_chacha20', 'quantum_hybrid', '{"algorithm":"ChaCha20-Poly1305","mode":"quantum_resistant"}', '00000000-0000-0000-0000-000000000002');

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to get user's teams
CREATE OR REPLACE FUNCTION get_user_teams()
RETURNS TABLE (
    team_id UUID,
    team_name TEXT,
    team_slug TEXT,
    role user_role,
    member_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id as team_id,
        t.name as team_name,
        t.slug as team_slug,
        tm.role as role,
        COUNT(tm.id)::BIGINT as member_count
    FROM teams t
    INNER JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = auth.uid()
    GROUP BY t.id, t.name, t.slug, tm.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's notifications
CREATE OR REPLACE FUNCTION get_user_notifications(limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
    id UUID,
    type notification_type,
    title TEXT,
    body TEXT,
    data JSONB,
    is_read BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.type,
        n.title,
        n.body,
        n.data,
        n.is_read,
        n.created_at
    FROM notifications n
    WHERE n.user_id = auth.uid()
    ORDER BY n.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search users
CREATE OR REPLACE FUNCTION search_users(search_query TEXT)
RETURNS TABLE (
    id UUID,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    role user_role
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.username,
        p.display_name,
        p.avatar_url,
        p.role
    FROM profiles p
    WHERE 
        p.username ILIKE '%' || search_query || '%'
        OR p.display_name ILIKE '%' || search_query || '%'
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;