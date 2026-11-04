---
description: 
---

Skema Database PostgreSQL (In-House Live Gallery)

Berikut adalah rancangan Entity Relationship beserta struktur tabel (DDL) yang telah dioptimalkan untuk mendukung pembuatan arsip ZIP, isolasi acara, dan penyimpanan path object (S3/R2).

1. Daftar Tabel & Relasi

users: Menyimpan data admin/operator internal SAVA.

events: Tabel pusat. Menyimpan konfigurasi, status, branding acara, dan status pembuatan file arsip ZIP.

ftp_credentials: Menyimpan username dan kredensial unik untuk login dari kamera ke FTP NestJS.

photos: Menyimpan metadata gambar. Menggunakan object_key alih-alih URL penuh untuk fleksibilitas migrasi cloud storage.

2. DDL (Data Definition Language) Script

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
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status event_status DEFAULT 'draft',
    theme_color VARCHAR(7) DEFAULT '#000000',
    custom_frame_key TEXT, -- Path object di bucket S3/R2 (bukan URL penuh)
    require_guest_moderation BOOLEAN DEFAULT FALSE,
    archive_zip_key TEXT, -- Path object untuk file ZIP final
    archive_status archive_status DEFAULT 'none', -- Melacak progres pembuatan ZIP
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Implementasi Soft Delete
);

-- 3. Tabel Kredensial FTP (1-to-1 dengan Events)
CREATE TABLE ftp_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Disarankan di-hash, NestJS akan memvalidasinya
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel Photos 
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    original_file_key TEXT NOT NULL, -- Path object foto mentah di S3/R2
    framed_file_key TEXT, -- Path object foto berbingkai di S3/R2
    source photo_source NOT NULL,
    guest_identifier VARCHAR(255), 
    status photo_status DEFAULT 'approved', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing untuk optimasi query
CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_ftp_username ON ftp_credentials(username);
CREATE INDEX idx_photos_event_id_created_at ON photos(event_id, created_at DESC);
CREATE INDEX idx_photos_status ON photos(status);

