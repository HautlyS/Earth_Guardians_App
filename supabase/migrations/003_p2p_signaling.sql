-- Earth Guardians - Migration 003: P2P Signaling & Connections
-- Adds peer registry, signaling messages, and connection history tables

-- P2P peer registry for WebRTC connections
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

-- P2P signaling messages for WebRTC negotiation
CREATE TABLE IF NOT EXISTS p2p_signaling (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_peer_id UUID NOT NULL REFERENCES auth.users(id),
    to_peer_id UUID NOT NULL REFERENCES auth.users(id),
    signal_type VARCHAR(20) NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice-candidate', 'leave')),
    payload JSONB NOT NULL,
    is_delivered BOOLEAN DEFAULT false,
    delivered_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- P2P connections history for analytics and reconnection
CREATE TABLE IF NOT EXISTS p2p_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    peer_a_id UUID NOT NULL REFERENCES auth.users(id),
    peer_b_id UUID NOT NULL REFERENCES auth.users(id),
    connection_type VARCHAR(20) DEFAULT 'direct' CHECK (connection_type IN ('direct', 'relayed')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'failed')),
    metadata JSONB DEFAULT '{}',
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (COALESCE(disconnected_at, NOW()) - connected_at))::INTEGER
    ) STORED
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_p2p_peers_user_id ON p2p_peers(user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_peers_peer_id ON p2p_peers(peer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_peers_online ON p2p_peers(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_p2p_signaling_from ON p2p_signaling(from_peer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_signaling_to ON p2p_signaling(to_peer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_signaling_not_delivered ON p2p_signaling(is_delivered) WHERE is_delivered = false;
CREATE INDEX IF NOT EXISTS idx_p2p_signaling_expires ON p2p_signaling(expires_at) WHERE is_delivered = false;
CREATE INDEX IF NOT EXISTS idx_p2p_connections_peers ON p2p_connections(peer_a_id, peer_b_id);
CREATE INDEX IF NOT EXISTS idx_p2p_connections_status ON p2p_connections(status);

-- RLS Policies
ALTER TABLE p2p_peers ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_signaling ENABLE ROW LEVEL SECURITY;
ALTER TABLE p2p_connections ENABLE ROW LEVEL SECURITY;

-- Users can manage their own peer record
CREATE POLICY "Users can manage own peer record" ON p2p_peers
    FOR ALL USING (user_id = auth.uid());

-- Users can view their own peer record
CREATE POLICY "Users can view own peer record" ON p2p_peers
    FOR SELECT USING (user_id = auth.uid());

-- Users can send signals to each other
CREATE POLICY "Users can view signals they sent or received" ON p2p_signaling
    FOR SELECT USING (from_peer_id = auth.uid() OR to_peer_id = auth.uid());

CREATE POLICY "Users can insert signals they send" ON p2p_signaling
    FOR INSERT WITH CHECK (from_peer_id = auth.uid());

CREATE POLICY "Users can update signals they receive" ON p2p_signaling
    FOR UPDATE USING (to_peer_id = auth.uid());

-- Users can view their own connections
CREATE POLICY "Users can view own connections" ON p2p_connections
    FOR SELECT USING (peer_a_id = auth.uid() OR peer_b_id = auth.uid());

CREATE POLICY "Users can insert own connections" ON p2p_connections
    FOR INSERT WITH CHECK (peer_a_id = auth.uid() OR peer_b_id = auth.uid());

CREATE POLICY "Users can update own connections" ON p2p_connections
    FOR UPDATE USING (peer_a_id = auth.uid() OR peer_b_id = auth.uid());

-- Functions for P2P management

-- Function to clean up expired signaling messages
CREATE OR REPLACE FUNCTION cleanup_expired_signals()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM p2p_signaling 
        WHERE expires_at < NOW() AND is_delivered = true
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark signal as delivered
CREATE OR REPLACE FUNCTION mark_signal_delivered(signal_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE p2p_signaling
    SET is_delivered = true, delivered_at = NOW()
    WHERE id = signal_id AND is_delivered = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending signals for a user
CREATE OR REPLACE FUNCTION get_pending_signals(user_id UUID)
RETURNS TABLE(
    id UUID,
    from_peer_id UUID,
    signal_type VARCHAR,
    payload JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT ps.id, ps.from_peer_id, ps.signal_type, ps.payload, ps.created_at
    FROM p2p_signaling ps
    WHERE ps.to_peer_id = user_id
    AND ps.is_delivered = false
    AND ps.expires_at > NOW()
    ORDER BY ps.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record a new connection
CREATE OR REPLACE FUNCTION record_connection(
    p_peer_a_id UUID,
    p_peer_b_id UUID,
    p_connection_type VARCHAR DEFAULT 'direct',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    connection_id UUID;
BEGIN
    INSERT INTO p2p_connections (peer_a_id, peer_b_id, connection_type, metadata)
    VALUES (p_peer_a_id, p_peer_b_id, p_connection_type, p_metadata)
    RETURNING id INTO connection_id;
    
    RETURN connection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to close a connection
CREATE OR REPLACE FUNCTION close_connection(
    p_peer_a_id UUID,
    p_peer_b_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE p2p_connections
    SET status = 'disconnected',
        disconnected_at = NOW()
    WHERE (peer_a_id = p_peer_a_id AND peer_b_id = p_peer_b_id)
    OR (peer_a_id = p_peer_b_id AND peer_b_id = p_peer_a_id)
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to clean up signals periodically (can be called by cron)
CREATE OR REPLACE FUNCTION schedule_signal_cleanup()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM cleanup_expired_signals();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup every 100 inserts (lightweight cleanup trigger)
CREATE TRIGGER on_signal_insert_cleanup
AFTER INSERT ON p2p_signaling
FOR EACH STATEMENT 
WHEN (floor(random() * 100)::int = 0)
EXECUTE FUNCTION schedule_signal_cleanup();

-- Comments
COMMENT ON TABLE p2p_peers IS 'WebRTC peer registry for P2P connections';
COMMENT ON TABLE p2p_signaling IS 'WebRTC signaling messages (offers, answers, ICE candidates)';
COMMENT ON TABLE p2p_connections IS 'P2P connection history and analytics';

-- Unique constraint on peer_id per user
ALTER TABLE p2p_peers ADD CONSTRAINT unique_peer_per_user UNIQUE (user_id);