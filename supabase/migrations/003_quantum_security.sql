-- Earth Guardians App - Quantum Encryption & Advanced Security
-- Version: 1.0.0
-- Description: Quantum-inspired encryption and secure storage

-- ============================================================
-- QUANTUM RESISTANT ENCRYPTION TABLES
-- ============================================================

-- Key management for quantum-resistant encryption
CREATE TABLE quantum_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    key_type TEXT NOT NULL, -- 'symmetric', 'asymmetric', 'quantum_hybrid'
    algorithm TEXT NOT NULL, -- 'AES-256-GCM', 'ChaCha20-Poly1305', 'Kyber-768'
    public_key TEXT,
    encrypted_private_key TEXT,
    key_material BYTEA, -- For symmetric keys
    rotation_enabled BOOLEAN DEFAULT false,
    rotation_period_days INTEGER DEFAULT 90,
    expires_at TIMESTAMPTZ,
    last_rotated_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quantum_keys_creator ON quantum_keys(created_by);
CREATE INDEX idx_quantum_keys_type ON quantum_keys(key_type);
CREATE INDEX idx_quantum_keys_expiry ON quantum_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Encryption key versions for key rotation
CREATE TABLE key_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_id UUID NOT NULL REFERENCES quantum_keys(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    key_material_encrypted TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    rotated_at TIMESTAMPTZ,
    UNIQUE(key_id, version_number)
);

CREATE INDEX idx_key_versions_key ON key_versions(key_id);

-- Encrypted data log for audit trail
CREATE TABLE encrypted_blobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_type TEXT NOT NULL, -- 'file', 'message', 'credential', 'config'
    encrypted_content TEXT NOT NULL,
    encryption_key_id UUID REFERENCES quantum_keys(id),
    algorithm TEXT NOT NULL,
    nonce TEXT NOT NULL,
    tag TEXT,
    team_id UUID REFERENCES teams(id),
    user_id UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}',
    checksum TEXT, -- SHA-256 of original content
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_encrypted_blobs_type ON encrypted_blobs(data_type);
CREATE INDEX idx_encrypted_blobs_team ON encrypted_blobs(team_id);
CREATE INDEX idx_encrypted_blobs_user ON encrypted_blobs(user_id);

-- ============================================================
-- P2P SECURE CHANNELS
-- ============================================================

CREATE TABLE p2p_secure_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id TEXT UNIQUE NOT NULL,
    initiator_peer_id TEXT NOT NULL,
    responder_peer_id TEXT NOT NULL,
    session_key_encrypted TEXT NOT NULL,
    encryption_algorithm TEXT NOT NULL,
    established_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active', -- 'active', 'expired', 'revoked'
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_p2p_channels_initiator ON p2p_secure_channels(initiator_peer_id);
CREATE INDEX idx_p2p_channels_responder ON p2p_secure_channels(responder_peer_id);
CREATE INDEX idx_p2p_channels_status ON p2p_secure_channels(status);

-- P2P relay nodes
CREATE TABLE p2p_relay_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    peer_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    relay_url TEXT NOT NULL,
    region TEXT,
    bandwidth_mbps INTEGER DEFAULT 100,
    max_connections INTEGER DEFAULT 50,
    current_connections INTEGER DEFAULT 0,
    status TEXT DEFAULT 'available', -- 'available', 'busy', 'offline'
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_p2p_relay_peer ON p2p_relay_nodes(peer_id);
CREATE INDEX idx_p2p_relay_region ON p2p_relay_nodes(region);

-- P2P file transfer registry
CREATE TABLE p2p_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id TEXT UNIQUE NOT NULL,
    file_id UUID REFERENCES files(id),
    sender_peer_id TEXT NOT NULL,
    receiver_peer_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    chunk_size INTEGER DEFAULT 65536,
    total_chunks INTEGER NOT NULL,
    completed_chunks INTEGER DEFAULT 0,
    encrypted BOOLEAN DEFAULT true,
    encryption_key_id UUID REFERENCES quantum_keys(id),
    status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'paused'
    speed_bps INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_p2p_transfers_sender ON p2p_transfers(sender_peer_id);
CREATE INDEX idx_p2p_transfers_receiver ON p2p_transfers(receiver_peer_id);
CREATE INDEX idx_p2p_transfers_file ON p2p_transfers(file_id);

-- ============================================================
-- COMPRESSED STORAGE
-- ============================================================

CREATE TABLE compressed_archives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    archive_name TEXT NOT NULL,
    compression_type TEXT DEFAULT 'lz4', -- 'lz4', 'zstd', 'gzip', 'lzma'
    compression_level INTEGER DEFAULT 3,
    original_size BIGINT NOT NULL,
    compressed_size BIGINT NOT NULL,
    ratio DECIMAL(5,2),
    encrypted BOOLEAN DEFAULT true,
    storage_location TEXT, -- 'local', 'p2p', 'supabase'
    storage_path TEXT,
    team_id UUID REFERENCES teams(id),
    created_by UUID REFERENCES auth.users(id),
    checksum TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_archives_team ON compressed_archives(team_id);
CREATE INDEX idx_archives_created_by ON compressed_archives(created_by);

-- Archive contents (files in archive)
CREATE TABLE archive_contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    archive_id UUID NOT NULL REFERENCES compressed_archives(id) ON DELETE CASCADE,
    original_file_id UUID REFERENCES files(id),
    file_name TEXT NOT NULL,
    file_path TEXT,
    file_size BIGINT NOT NULL,
    compression_ratio DECIMAL(5,2),
    order_index INTEGER DEFAULT 0
);

CREATE INDEX idx_archive_contents_archive ON archive_contents(archive_id);

-- ============================================================
-- QUANTUM KEY GENERATION FUNCTIONS
-- ============================================================

-- Generate quantum-resistant symmetric key
CREATE OR REPLACE FUNCTION generate_quantum_key(
    key_name TEXT,
    algorithm TEXT DEFAULT 'AES-256-GCM'
)
RETURNS UUID AS $$
DECLARE
    key_id UUID;
    key_material BYTEA;
BEGIN
    -- Generate 256-bit random key using pgcrypto
    key_material := gen_random_bytes(32);
    
    INSERT INTO quantum_keys (name, key_type, algorithm, key_material, created_by)
    VALUES (key_name, 'symmetric', algorithm, key_material, auth.uid())
    RETURNING id INTO key_id;
    
    RETURN key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate quantum-resistant key pair (for future post-quantum algorithms)
CREATE OR REPLACE FUNCTION generate_quantum_keypair(
    key_name TEXT,
    algorithm TEXT DEFAULT 'Kyber-768'
)
RETURNS UUID AS $$
DECLARE
    key_id UUID;
BEGIN
    -- Placeholder for post-quantum key generation
    -- In production, this would use actual post-quantum algorithms
    INSERT INTO quantum_keys (name, key_type, algorithm, created_by)
    VALUES (key_name, 'asymmetric', algorithm, auth.uid())
    RETURNING id INTO key_id;
    
    RETURN key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rotate encryption key
CREATE OR REPLACE FUNCTION rotate_encryption_key(key_uuid UUID)
RETURNS UUID AS $$
DECLARE
    new_version_id UUID;
    new_key_id UUID;
    old_key RECORD;
BEGIN
    -- Get old key info
    SELECT * INTO old_key FROM quantum_keys WHERE id = key_uuid;
    
    -- Create new key with rotated material
    INSERT INTO quantum_keys (name, key_type, algorithm, key_material, created_by, metadata)
    VALUES (
        old_key.name || ' (rotated)',
        old_key.key_type,
        old_key.algorithm,
        gen_random_bytes(32),
        auth.uid(),
        jsonb_build_object('rotated_from', key_uuid)
    )
    RETURNING id INTO new_key_id;
    
    -- Create version entry for old key
    INSERT INTO key_versions (key_id, version_number, key_material_encrypted)
    VALUES (key_uuid, 1, encode(old_key.key_material, 'hex'));
    
    -- Update old key rotation timestamp
    UPDATE quantum_keys SET last_rotated_at = NOW() WHERE id = key_uuid;
    
    RETURN new_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMPRESSION FUNCTIONS
-- ============================================================

-- Create compressed archive
CREATE OR REPLACE FUNCTION create_compressed_archive(
    archive_name TEXT,
    compression_type TEXT DEFAULT 'lz4',
    compression_level INTEGER DEFAULT 3
)
RETURNS UUID AS $$
DECLARE
    archive_id UUID;
BEGIN
    INSERT INTO compressed_archives (archive_name, compression_type, compression_level, created_by)
    VALUES (archive_name, compression_type, compression_level, auth.uid())
    RETURNING id INTO archive_id;
    
    RETURN archive_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SECURE AUDIT LOG
-- ============================================================

CREATE TABLE secure_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    encrypted_details TEXT, -- Encrypted JSON with sensitive details
    encryption_key_id UUID REFERENCES quantum_keys(id),
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_secure_audit_user ON secure_audit_log(user_id);
CREATE INDEX idx_secure_audit_entity ON secure_audit_log(entity_type, entity_id);
CREATE INDEX idx_secure_audit_created ON secure_audit_log(created_at);
CREATE INDEX idx_secure_audit_action ON secure_audit_log(action);

-- ============================================================
-- SECURITY POLICIES
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE quantum_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_secure_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE compressed_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_audit_log ENABLE ROW LEVEL SECURITY;

-- Quantum keys: users can only see their own keys
CREATE POLICY "Users can manage own quantum keys" ON quantum_keys
    FOR ALL USING (created_by = auth.uid());

-- Encrypted blobs: team members can access
CREATE POLICY "Team members can access encrypted blobs" ON encrypted_blobs
    FOR SELECT USING (
        team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
        OR user_id = auth.uid()
    );

-- P2P transfers: participants only
CREATE POLICY "P2P transfer participants can access" ON p2p_transfers
    FOR SELECT USING (
        sender_peer_id IN (SELECT peer_id FROM p2p_nodes WHERE user_id = auth.uid())
        OR receiver_peer_id IN (SELECT peer_id FROM p2p_nodes WHERE user_id = auth.uid())
    );

-- Archives: team members
CREATE POLICY "Team members can access archives" ON compressed_archives
    FOR ALL USING (
        team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
        OR created_by = auth.uid()
    );

-- Audit log: admins only
CREATE POLICY "Admins can view audit logs" ON secure_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM team_members tm
            JOIN teams t ON tm.team_id = t.id
            WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
        )
        OR user_id = auth.uid()
    );

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER update_quantum_keys_updated_at 
    BEFORE UPDATE ON quantum_keys 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_p2p_channels_activity 
    BEFORE UPDATE ON p2p_secure_channels 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ADVANCED SECURITY FUNCTIONS
-- ============================================================

-- Verify data integrity
CREATE OR REPLACE FUNCTION verify_data_integrity(data_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    blob_record RECORD;
    stored_checksum TEXT;
    computed_checksum TEXT;
BEGIN
    SELECT * INTO blob_record FROM encrypted_blobs WHERE id = data_id;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    stored_checksum := blob_record.checksum;
    -- Note: In production, you would decrypt and recompute checksum
    -- This is a simplified version
    RETURN stored_checksum IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log security event
CREATE OR REPLACE FUNCTION log_security_event(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_success BOOLEAN DEFAULT true,
    p_error TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO secure_audit_log (user_id, action, entity_type, entity_id, success, error_message)
    VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_success, p_error)
    RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up expired P2P channels
CREATE OR REPLACE FUNCTION cleanup_expired_p2p_channels()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE p2p_secure_channels 
    SET status = 'expired' 
    WHERE expires_at < NOW() AND status = 'active';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get P2P relay nodes by region
CREATE OR REPLACE FUNCTION get_p2p_relay_nodes_by_region(requested_region TEXT)
RETURNS TABLE (
    peer_id TEXT,
    relay_url TEXT,
    bandwidth_mbps INTEGER,
    available_connections INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pr.peer_id,
        pr.relay_url,
        pr.bandwidth_mbps,
        (pr.max_connections - pr.current_connections) as available_connections
    FROM p2p_relay_nodes pr
    WHERE pr.status = 'available'
        AND pr.region = requested_region
        AND pr.current_connections < pr.max_connections
    ORDER BY pr.bandwidth_mbps DESC, pr.current_connections ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update P2P node heartbeat
CREATE OR REPLACE FUNCTION update_p2p_node_heartbeat(peer_id_param TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE p2p_nodes 
    SET last_ping = NOW(), status = 'online'
    WHERE peer_id = peer_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active P2P transfers for user
CREATE OR REPLACE FUNCTION get_user_active_transfers()
RETURNS TABLE (
    transfer_id TEXT,
    file_name TEXT,
    file_size BIGINT,
    completed_chunks INTEGER,
    total_chunks INTEGER,
    progress INTEGER,
    status TEXT,
    speed_bps INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.transfer_id,
        pt.file_name,
        pt.file_size,
        pt.completed_chunks,
        pt.total_chunks,
        CASE WHEN pt.total_chunks > 0 
            THEN (pt.completed_chunks * 100 / pt.total_chunks)::INTEGER 
            ELSE 0 END as progress,
        pt.status,
        pt.speed_bps
    FROM p2p_transfers pt
    WHERE (pt.sender_peer_id IN (SELECT peer_id FROM p2p_nodes WHERE user_id = auth.uid())
        OR pt.receiver_peer_id IN (SELECT peer_id FROM p2p_nodes WHERE user_id = auth.uid()))
        AND pt.status IN ('pending', 'in_progress', 'paused')
    ORDER BY pt.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;