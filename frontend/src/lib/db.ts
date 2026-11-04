import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  'postgresql://neondb_owner:npg_trGnvo5y7YxB@ep-polished-star-bb1jwyrk-pooler.c-15.us-east-1.aws.neon.tech/neondb?sslmode=require';

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

let schemaInitialized = false;

export async function ensureDbSchema(): Promise<void> {
  if (schemaInitialized) return;
  const db = getDbPool();

  try {
    // 1. Create tables if not exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(64) PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        header_subtitle VARCHAR(150) DEFAULT 'The Wedding of',
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        theme_color VARCHAR(20) DEFAULT '#D4AF37',
        header_image_url TEXT,
        custom_frame_key TEXT,
        custom_frame_url TEXT,
        require_guest_moderation BOOLEAN DEFAULT FALSE,
        guest_upload_limit INTEGER DEFAULT 5,
        archive_zip_key TEXT,
        archive_download_url TEXT,
        archive_status VARCHAR(20) DEFAULT 'none',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ftp_credentials (
        id VARCHAR(64) PRIMARY KEY,
        event_id VARCHAR(64) UNIQUE REFERENCES events(id) ON DELETE CASCADE,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS photos (
        id VARCHAR(64) PRIMARY KEY,
        event_slug VARCHAR(100) NOT NULL,
        url TEXT NOT NULL,
        thumbnail_url TEXT,
        source VARCHAR(20) NOT NULL,
        guest_identifier VARCHAR(255),
        guest_name VARCHAR(100),
        status VARCHAR(20) DEFAULT 'approved',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
      CREATE INDEX IF NOT EXISTS idx_photos_event_slug ON photos(event_slug, created_at DESC);
    `);

    // Insert default events if events table is empty
    const checkEvents = await db.query('SELECT COUNT(*) FROM events');
    const count = parseInt(checkEvents.rows[0].count, 10);
    if (count === 0) {
      await db.query(`
        INSERT INTO events (
          id, slug, name, header_subtitle, start_time, end_time, status,
          theme_color, header_image_url, guest_upload_limit, require_guest_moderation
        ) VALUES (
          'demo-evt-1', 'budi-ani', 'Budi & Ani', 'The Wedding of',
          NOW() - INTERVAL '2 hours', NOW() + INTERVAL '6 hours', 'active',
          '#D4AF37', 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=80',
          5, false
        ) ON CONFLICT (slug) DO NOTHING;

        INSERT INTO ftp_credentials (id, event_id, username, password, is_active)
        VALUES ('ftp-1', 'demo-evt-1', 'budi-ani', '123456', true)
        ON CONFLICT (username) DO NOTHING;
      `);
    }

    schemaInitialized = true;
  } catch (err) {
    console.error('Failed to initialize DB schema:', err);
  }
}

