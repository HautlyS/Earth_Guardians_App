-- Earth Guardians Platform - Complete Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('staff','regional_councilor','crew_leader','crew_member','stakeholder','partner');
CREATE TYPE project_status AS ENUM ('planning','active','on_hold','completed','archived');
CREATE TYPE task_status AS ENUM ('backlog','todo','in_progress','review','done','blocked');
CREATE TYPE document_type AS ENUM ('document','spreadsheet','form','presentation');
CREATE TYPE email_priority AS ENUM ('low','normal','high','urgent');

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    role user_role DEFAULT 'crew_member',
    status TEXT DEFAULT 'offline',
    settings JSONB DEFAULT '{"theme":"light","notifications":true}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE regions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id UUID REFERENCES regions(id),
    name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crew_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    role user_role DEFAULT 'crew_member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(crew_id, user_id)
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crew_id UUID REFERENCES crews(id),
    name TEXT NOT NULL, description TEXT,
    status project_status DEFAULT 'planning',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status task_status DEFAULT 'todo',
    assignees UUID[] DEFAULT '{}',
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    creator_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    doc_type document_type DEFAULT 'document',
    content JSONB DEFAULT '{"blocks":[]}',
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    priority email_priority DEFAULT 'normal',
    is_read BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users(id),
    recipient_type TEXT DEFAULT 'to',
    UNIQUE(message_id, recipient_id, recipient_type)
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL, body TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (user_id, username, display_name)
    VALUES (NEW.id, split_part(NEW.email,'@',1), split_part(NEW.email,'@',1));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Crews visible" ON crews FOR SELECT USING (id IN (SELECT crew_id FROM crew_members WHERE user_id = auth.uid()));
CREATE POLICY "Email viewable" ON email_messages FOR SELECT USING (sender_id = auth.uid() OR id IN (SELECT message_id FROM email_recipients WHERE recipient_id = auth.uid()));
CREATE POLICY "Notifications viewable" ON notifications FOR SELECT USING (user_id = auth.uid());
