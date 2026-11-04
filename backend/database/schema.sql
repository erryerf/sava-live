-- Skema Database PostgreSQL (In-House Live Gallery)

-- Membuat tipe data ENUM
CREATE TYPE event_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE archive_status AS ENUM ('none', 'processing', 'ready', 'failed');
CREATE TYPE photo_source AS ENUM ('photographer', 'guest');
CREATE TYPE photo_status AS ENUM ('pending', 'approved', 'rejected');

-- 1. Tabel Internal Users (Admin)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Events (Pusat Isolasi Data)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    header_subtitle VARCHAR(150) DEFAULT 'The Wedding of',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status event_status DEFAULT 'draft',
    theme_color VARCHAR(7) DEFAULT '#000000',
    header_image_key TEXT,
    custom_frame_key TEXT,
    require_guest_moderation BOOLEAN DEFAULT FALSE,
    guest_upload_limit INTEGER DEFAULT 5,
    archive_zip_key TEXT,
    archive_status archive_status DEFAULT 'none',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 3. Tabel Kredensial FTP (1-to-1 dengan Events)
CREATE TABLE ftp_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel Photos
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    original_file_key TEXT NOT NULL,
    framed_file_key TEXT,
    source photo_source NOT NULL,
    guest_identifier VARCHAR(255),
    guest_name VARCHAR(100),
    status photo_status DEFAULT 'approved',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing untuk optimasi query
CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_ftp_username ON ftp_credentials(username);
CREATE INDEX idx_photos_event_id_created_at ON photos(event_id, created_at DESC);
CREATE INDEX idx_photos_status ON photos(status);

