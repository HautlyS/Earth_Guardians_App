-- Earth Guardians - Migration 005: Documents & Storage
-- Adds document versioning, sharing, and storage metadata tables

-- Document versioning
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL,
    changes_summary TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);

-- Document sharing
CREATE TABLE IF NOT EXISTS document_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    shared_with UUID NOT NULL REFERENCES auth.users(id),
    permission VARCHAR(20) DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
    shared_by UUID NOT NULL REFERENCES auth.users(id),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(document_id, shared_with)
);

-- Document access log
CREATE TABLE IF NOT EXISTS document_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action VARCHAR(30) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage metadata
CREATE TABLE IF NOT EXISTS storage_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    mime_type VARCHAR(100),
    file_size BIGINT,
    storage_path TEXT NOT NULL,
    bucket VARCHAR(100) DEFAULT 'assets',
    encryption_key TEXT,
    compression_used BOOLEAN DEFAULT false,
    thumbnail_path TEXT,
    metadata JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storage folders/buckets for organization
CREATE TABLE IF NOT EXISTS storage_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES storage_folders(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    crew_id UUID REFERENCES crews(id),
    path TEXT GENERATED ALWAYS AS (
        ARRAY_TO_STRING(
            ARRAY(
                WITH RECURSIVE folder_path AS (
                    SELECT id, name, parent_id, ARRAY[name] as path_array
                    FROM storage_folders
                    WHERE id = storage_folders.parent_id
                    UNION ALL
                    SELECT f.id, f.name, f.parent_id, folder_path.path_array || f.name
                    FROM storage_folders f
                    INNER JOIN folder_path ON f.id = folder_path.parent_id
                )
                SELECT path_array FROM folder_path WHERE id = storage_folders.parent_id
            ), '/'
        ) || '/' || name
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_versions_doc_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_number ON document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_document_shares_doc_id ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_user_id ON document_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_document_shares_expiry ON document_shares(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_access_log_doc_id ON document_access_log(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_log_user_id ON document_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_document_access_log_created ON document_access_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_metadata_user_id ON storage_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_storage_metadata_bucket ON storage_metadata(bucket);
CREATE INDEX IF NOT EXISTS idx_storage_metadata_public ON storage_metadata(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_storage_folders_owner ON storage_folders(owner_id);
CREATE INDEX IF NOT EXISTS idx_storage_folders_parent ON storage_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_storage_folders_crew ON storage_folders(crew_id) WHERE crew_id IS NOT NULL;

-- RLS Policies
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_folders ENABLE ROW LEVEL SECURITY;

-- Document versions visible to document access
CREATE POLICY "Document versions viewable by document access" ON document_versions
    FOR SELECT USING (
        document_id IN (
            SELECT id FROM documents WHERE creator_id = auth.uid()
        )
    );

CREATE POLICY "Document versions insertable by document owner" ON document_versions
    FOR INSERT WITH CHECK (
        document_id IN (SELECT id FROM documents WHERE creator_id = auth.uid())
    );

-- Document shares visible to recipient or sender
CREATE POLICY "Document shares viewable by involved parties" ON document_shares
    FOR SELECT USING (shared_with = auth.uid() OR shared_by = auth.uid());

CREATE POLICY "Document shares manageable by owner" ON document_shares
    FOR ALL USING (
        document_id IN (SELECT id FROM documents WHERE creator_id = auth.uid())
    );

CREATE POLICY "Document shares insertable by document owner" ON document_shares
    FOR INSERT WITH CHECK (
        document_id IN (SELECT id FROM documents WHERE creator_id = auth.uid())
    );

-- Document access log
CREATE POLICY "Document access log viewable by document owner" ON document_access_log
    FOR SELECT USING (
        document_id IN (SELECT id FROM documents WHERE creator_id = auth.uid())
        OR user_id = auth.uid()
    );

CREATE POLICY "Document access log insertable by system" ON document_access_log
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Storage metadata viewable by owner or public
CREATE POLICY "Storage metadata viewable by owner or public" ON storage_metadata
    FOR SELECT USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY "Storage metadata manageable by owner" ON storage_metadata
    FOR ALL USING (user_id = auth.uid());

-- Storage folders viewable by owner or crew members
CREATE POLICY "Storage folders viewable by owner or crew" ON storage_folders
    FOR SELECT USING (
        owner_id = auth.uid()
        OR crew_id IN (SELECT crew_id FROM crew_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Storage folders manageable by owner" ON storage_folders
    FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Storage folders insertable by authenticated" ON storage_folders
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Functions for document management

-- Function to create document version
CREATE OR REPLACE FUNCTION create_document_version(
    p_document_id UUID,
    p_content JSONB,
    p_changes_summary TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_version_number INTEGER;
    v_version_id UUID;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
    FROM document_versions
    WHERE document_id = p_document_id;
    
    -- Insert version
    INSERT INTO document_versions (document_id, version_number, content, changes_summary, created_by)
    VALUES (p_document_id, v_version_number, p_content, p_changes_summary, auth.uid())
    RETURNING id INTO v_version_id;
    
    -- Log access
    INSERT INTO document_access_log (document_id, user_id, action, metadata)
    VALUES (p_document_id, auth.uid(), 'version_created', jsonb_build_object('version', v_version_number));
    
    RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get document with access check
CREATE OR REPLACE FUNCTION get_document_with_access(
    p_document_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    doc_type VARCHAR,
    content JSONB,
    is_public BOOLEAN,
    creator_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT d.id, d.title, d.doc_type, d.content, d.is_public, d.creator_id
    FROM documents d
    WHERE d.id = p_document_id
    AND (
        d.creator_id = COALESCE(p_user_id, auth.uid())
        OR d.is_public = true
        OR EXISTS (
            SELECT 1 FROM document_shares ds 
            WHERE ds.document_id = d.id 
            AND ds.shared_with = COALESCE(p_user_id, auth.uid())
            AND (ds.expires_at IS NULL OR ds.expires_at > NOW())
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to share document
CREATE OR REPLACE FUNCTION share_document(
    p_document_id UUID,
    p_shared_with UUID,
    p_permission VARCHAR,
    p_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    share_id UUID;
BEGIN
    INSERT INTO document_shares (document_id, shared_with, permission, shared_by, message)
    VALUES (p_document_id, p_shared_with, p_permission, auth.uid(), p_message)
    ON CONFLICT (document_id, shared_with) 
    DO UPDATE SET permission = p_permission, shared_by = auth.uid()
    RETURNING id INTO share_id;
    
    -- Log access
    INSERT INTO document_access_log (document_id, user_id, action, metadata)
    VALUES (p_document_id, auth.uid(), 'shared', jsonb_build_object('shared_with', p_shared_with, 'permission', p_permission));
    
    RETURN share_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record storage download
CREATE OR REPLACE FUNCTION record_storage_download(p_storage_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE storage_metadata
    SET download_count = download_count + 1
    WHERE id = p_storage_id;
    
    INSERT INTO document_access_log (document_id, user_id, action)
    VALUES (p_storage_id, auth.uid(), 'downloaded');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log document access
CREATE OR REPLACE FUNCTION log_document_access()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO document_access_log (document_id, user_id, action, metadata)
    VALUES (NEW.id, auth.uid(), 'created', '{}');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_document_create
AFTER INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION log_document_access();

-- Comments
COMMENT ON TABLE document_versions IS 'Document version history for collaboration and rollback';
COMMENT ON TABLE document_shares IS 'Document sharing with permissions';
COMMENT ON TABLE document_access_log IS 'Document access audit trail';
COMMENT ON TABLE storage_metadata IS 'File storage metadata and tracking';
COMMENT ON TABLE storage_folders IS 'File organization and folder structure';

-- Update existing documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;