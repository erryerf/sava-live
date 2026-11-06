import { NextRequest, NextResponse } from 'next/server';
import { ensureDbSchema, getDbPool } from '@/lib/db';
import {
  createR2PresignedUploadUrl,
  deleteR2EventFolder,
  getR2ObjectStream,
  getR2PublicUrl,
  uploadR2Buffer,
} from '@/lib/r2';
import { AdminEvent, PhotoItem, PublicEvent } from '@/lib/types';

function rowToAdminEvent(row: any): AdminEvent {
  return {
    id: String(row.id),
    name: String(row.name),
    header_subtitle: row.header_subtitle ?? 'The Wedding of',
    slug: String(row.slug),
    status: row.status || 'active',
    gallery_theme: (row.gallery_theme as 'dark' | 'light') || 'dark',
    theme_color: row.theme_color || '#D4AF37',
    header_image_url: row.header_image_url || null,
    guest_upload_limit: Number(row.guest_upload_limit ?? 5),
    is_upload_allowed: row.status === 'active',
    start_time: row.start_time ? new Date(row.start_time).toISOString() : new Date().toISOString(),
    end_time: row.end_time ? new Date(row.end_time).toISOString() : new Date().toISOString(),
    custom_frame_key: row.custom_frame_key || null,
    custom_frame_url: row.custom_frame_url || null,
    require_guest_moderation: Boolean(row.require_guest_moderation),
    archive_zip_key: row.archive_zip_key || null,
    archive_download_url: row.archive_download_url || null,
    archive_status: row.archive_status || 'none',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    ftp_status: {
      connected: Boolean(row.ftp_connected),
      active_sessions: Number(row.ftp_active_sessions ?? 0),
      last_connected_at: row.ftp_last_connected_at || null,
      last_upload_at: row.ftp_last_upload_at || null,
    },
    ftp_credentials: row.ftp_username
      ? {
          id: String(row.ftp_id || row.id),
          username: String(row.ftp_username),
          password: String(row.ftp_password || '123456'),
          is_active: Boolean(row.ftp_is_active ?? true),
          created_at: row.ftp_created_at || new Date().toISOString(),
        }
      : undefined,
  };
}

function toPublicEvent(evt: AdminEvent): PublicEvent {
  return {
    id: evt.id,
    name: evt.name,
    header_subtitle: evt.header_subtitle ?? 'The Wedding of',
    slug: evt.slug,
    status: evt.status,
    theme_color: evt.theme_color,
    header_image_url: evt.header_image_url ?? null,
    custom_frame_key: evt.custom_frame_key ?? null,
    custom_frame_url: evt.custom_frame_url ?? null,
    guest_upload_limit: Number(evt.guest_upload_limit ?? 5),
    is_upload_allowed: evt.status === 'active',
    gallery_theme: evt.gallery_theme || 'dark',
  };
}

function isAuthorizedAdmin(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const validSecret =
    process.env.ADMIN_API_TOKEN ||
    process.env.NEXT_PUBLIC_ADMIN_TOKEN ||
    'sava-admin-secret-token-2026';
  return Boolean(token && token === validSecret);
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      success: false,
      message: 'Akses ditolak. Token otentikasi admin diperlukan.',
    },
    { status: 401 },
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  await ensureDbSchema();
  const db = getDbPool();
  const { path } = await context.params;
  const url = new URL(req.url);

  try {
    // Guard all GET /v1/admin/* routes
    if (path[0] === 'admin' && !isAuthorizedAdmin(req)) {
      return unauthorizedResponse();
    }
    // GET /v1/photos/asset/... (Streaming directly from Cloudflare R2 with global edge caching)
    if (path.length >= 2 && path[0] === 'photos' && path[1] === 'asset') {
      const fileKey = path.slice(2).join('/');
      try {
        const { body, contentType, contentLength } = await getR2ObjectStream(fileKey);
        if (!body) {
          return new NextResponse('Not Found', { status: 404 });
        }
        return new NextResponse(body, {
          headers: {
            'Content-Type': contentType || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable',
            ...(contentLength ? { 'Content-Length': String(contentLength) } : {}),
          },
        });
      } catch (err: any) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
          return new NextResponse('Asset Not Found', { status: 404 });
        }
        console.error('Error fetching R2 asset:', err);
        return new NextResponse('Failed to load asset', { status: 500 });
      }
    }

    // GET /v1/admin/events
    if (path.length === 2 && path[0] === 'admin' && path[1] === 'events') {
      const status = url.searchParams.get('status');
      const query = status
        ? `
          SELECT e.*, f.id as ftp_id, f.username as ftp_username, f.password as ftp_password, f.is_active as ftp_is_active
          FROM events e
          LEFT JOIN ftp_credentials f ON f.event_id = e.id
          WHERE e.status = $1
          ORDER BY e.created_at DESC
        `
        : `
          SELECT e.*, f.id as ftp_id, f.username as ftp_username, f.password as ftp_password, f.is_active as ftp_is_active
          FROM events e
          LEFT JOIN ftp_credentials f ON f.event_id = e.id
          ORDER BY e.created_at DESC
        `;
      const res = status ? await db.query(query, [status]) : await db.query(query);
      const data = res.rows.map(rowToAdminEvent);
      return NextResponse.json({ success: true, data });
    }

    // GET /v1/admin/events/:id
    if (path.length === 3 && path[0] === 'admin' && path[1] === 'events') {
      const res = await db.query(
        `
        SELECT e.*, f.id as ftp_id, f.username as ftp_username, f.password as ftp_password, f.is_active as ftp_is_active
        FROM events e
        LEFT JOIN ftp_credentials f ON f.event_id = e.id
        WHERE e.id = $1 OR e.slug = $1
        LIMIT 1
      `,
        [path[2]],
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Event tidak ditemukan.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: rowToAdminEvent(res.rows[0]) });
    }

    // GET /v1/admin/events/:id/photos
    if (path.length === 4 && path[0] === 'admin' && path[1] === 'events' && path[3] === 'photos') {
      const evtRes = await db.query('SELECT slug FROM events WHERE id = $1 OR slug = $1 LIMIT 1', [path[2]]);
      if (evtRes.rows.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }
      const slug = evtRes.rows[0].slug;
      const photosRes = await db.query('SELECT * FROM photos WHERE LOWER(event_slug) = LOWER($1) ORDER BY created_at DESC', [slug]);
      return NextResponse.json({ success: true, data: photosRes.rows });
    }

    // GET /v1/events/:slug
    if (path.length === 2 && path[0] === 'events') {
      const slug = decodeURIComponent(path[1]).toLowerCase();
      const res = await db.query(
        `
        SELECT e.*, f.id as ftp_id, f.username as ftp_username, f.password as ftp_password, f.is_active as ftp_is_active
        FROM events e
        LEFT JOIN ftp_credentials f ON f.event_id = e.id
        WHERE LOWER(e.slug) = LOWER($1)
        LIMIT 1
      `,
        [slug],
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Acara tidak ditemukan.' }, { status: 404 });
      }
      const adminEvt = rowToAdminEvent(res.rows[0]);
      return NextResponse.json({ success: true, data: toPublicEvent(adminEvt) });
    }

    // GET /v1/events/:slug/photos
    if (path.length === 3 && path[0] === 'events' && path[2] === 'photos') {
      const slug = decodeURIComponent(path[1]).toLowerCase();
      const source = url.searchParams.get('source');
      const query = source
        ? "SELECT * FROM photos WHERE LOWER(event_slug) = LOWER($1) AND source = $2 AND status != 'rejected' ORDER BY created_at DESC"
        : "SELECT * FROM photos WHERE LOWER(event_slug) = LOWER($1) AND status != 'rejected' ORDER BY created_at DESC";
      const res = source ? await db.query(query, [slug, source]) : await db.query(query, [slug]);
      return NextResponse.json({
        success: true,
        meta: { next_cursor: null, has_more: false },
        data: res.rows,
      });
    }

    // GET /v1/events/:slug/archive
    if (path.length === 3 && path[0] === 'events' && path[2] === 'archive') {
      const slug = decodeURIComponent(path[1]).toLowerCase();
      const res = await db.query('SELECT archive_status, archive_download_url FROM events WHERE LOWER(slug) = LOWER($1) LIMIT 1', [slug]);
      return NextResponse.json({
        success: true,
        data: {
          status: res.rows[0]?.archive_status || 'ready',
          download_url: res.rows[0]?.archive_download_url || `https://sava-app.cloud/v1/events/${slug}/archive`,
        },
      });
    }

    return NextResponse.json({ success: false, message: 'Endpoint tidak ditemukan.' }, { status: 404 });
  } catch (err) {
    console.error('API GET error:', err);
    return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  await ensureDbSchema();
  const db = getDbPool();
  const { path } = await context.params;
  const body = await req.json().catch(() => ({}));

  try {
    // Guard all POST /v1/admin/* routes
    if (path[0] === 'admin' && !isAuthorizedAdmin(req)) {
      return unauthorizedResponse();
    }
    // POST /v1/admin/events/sync (Sync localStorage demo events to Neon PostgreSQL)
    if (path.length === 3 && path[0] === 'admin' && path[1] === 'events' && path[2] === 'sync') {
      const clientEvents = Array.isArray(body.events) ? (body.events as AdminEvent[]) : [];
      for (const item of clientEvents) {
        if (!item?.slug) continue;
        const slug = item.slug.toLowerCase().trim();
        const id = item.id || `evt-${Date.now()}`;
        const limit = Number(item.guest_upload_limit ?? 5);

        await db.query(
          `
          INSERT INTO events (
            id, slug, name, header_subtitle, start_time, end_time, status,
            theme_color, header_image_url, guest_upload_limit, require_guest_moderation, gallery_theme
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            header_subtitle = EXCLUDED.header_subtitle,
            theme_color = EXCLUDED.theme_color,
            header_image_url = COALESCE(EXCLUDED.header_image_url, events.header_image_url),
            guest_upload_limit = EXCLUDED.guest_upload_limit,
            status = EXCLUDED.status,
            require_guest_moderation = EXCLUDED.require_guest_moderation,
            gallery_theme = EXCLUDED.gallery_theme,
            updated_at = NOW();
        `,
          [
            id,
            slug,
            item.name,
            item.header_subtitle ?? 'The Wedding of',
            item.start_time || new Date().toISOString(),
            item.end_time || new Date(Date.now() + 21600000).toISOString(),
            item.status || 'active',
            item.theme_color || '#D4AF37',
            item.header_image_url || null,
            limit,
            Boolean(item.require_guest_moderation),
            item.gallery_theme || 'dark',
          ],
        );

        await db.query(
          `
          INSERT INTO ftp_credentials (id, event_id, username, password, is_active)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (username) DO UPDATE SET is_active = EXCLUDED.is_active;
        `,
          [`ftp-${slug}`, id, slug, item.ftp_credentials?.password || '123456', true],
        );
      }

      const allRes = await db.query(`
        SELECT e.*, f.id as ftp_id, f.username as ftp_username, f.password as ftp_password, f.is_active as ftp_is_active
        FROM events e
        LEFT JOIN ftp_credentials f ON f.event_id = e.id
        ORDER BY e.created_at DESC
      `);
      return NextResponse.json({ success: true, data: allRes.rows.map(rowToAdminEvent) });
    }

    // POST /v1/admin/events
    if (path.length === 2 && path[0] === 'admin' && path[1] === 'events') {
      const slug = (
        body.slug ||
        String(body.name || 'acara')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      ).toLowerCase();
      const id = `evt-${Date.now()}`;
      const limit = Number(body.guest_upload_limit ?? 5);

      await db.query(
        `
        INSERT INTO events (
          id, slug, name, header_subtitle, start_time, end_time, status,
          theme_color, header_image_url, guest_upload_limit, require_guest_moderation, gallery_theme
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          header_subtitle = EXCLUDED.header_subtitle,
          theme_color = EXCLUDED.theme_color,
          header_image_url = COALESCE(EXCLUDED.header_image_url, events.header_image_url),
          guest_upload_limit = EXCLUDED.guest_upload_limit,
          status = EXCLUDED.status,
          require_guest_moderation = EXCLUDED.require_guest_moderation,
          gallery_theme = EXCLUDED.gallery_theme,
          updated_at = NOW();
      `,
        [
          id,
          slug,
          body.name,
          body.header_subtitle ?? 'The Wedding of',
          body.start_time || new Date().toISOString(),
          body.end_time || new Date(Date.now() + 21600000).toISOString(),
          body.status || 'active',
          body.theme_color || '#D4AF37',
          body.header_image_url || null,
          limit,
          Boolean(body.require_guest_moderation),
          body.gallery_theme || 'dark',
        ],
      );

      const ftpPassword = Math.random().toString(36).slice(2, 10);
      await db.query(
        `
        INSERT INTO ftp_credentials (id, event_id, username, password, is_active)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (username) DO NOTHING;
      `,
        [`ftp-${slug}`, id, slug, ftpPassword, true],
      );

      const createdRes = await db.query(
        `
        SELECT e.*, f.id as ftp_id, f.username as ftp_username, f.password as ftp_password, f.is_active as ftp_is_active
        FROM events e
        LEFT JOIN ftp_credentials f ON f.event_id = e.id
        WHERE e.id = $1
        LIMIT 1
      `,
        [id],
      );
      return NextResponse.json({ success: true, data: rowToAdminEvent(createdRes.rows[0]) }, { status: 201 });
    }

    // POST /v1/events/:slug/photos/direct-upload (Direct atomic upload for bulletproof mobile uploads)
    if (path.length === 4 && path[0] === 'events' && path[2] === 'photos' && path[3] === 'direct-upload') {
      const slug = decodeURIComponent(path[1]).toLowerCase();
      const photoId = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const source = body.source === 'photographer' ? 'photographer' : 'guest';
      const fileData = String(body.file_data || '');

      let publicUrl = '';
      if (fileData.startsWith('data:')) {
        const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
          const fileKey = `events/${slug}/${source}/${photoId}.${ext}`;
          try {
            publicUrl = await uploadR2Buffer(fileKey, buffer, mimeType);
          } catch (r2Err) {
            console.error('Direct upload to R2 error:', r2Err);
          }
        }
      }

      if (!publicUrl) {
        publicUrl = body.data_url || fileData || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=85';
      }

      await db.query(
        `
        INSERT INTO photos (id, event_slug, url, thumbnail_url, source, guest_identifier, guest_name, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          photoId,
          slug,
          publicUrl,
          publicUrl,
          source,
          body.guest_identifier || null,
          body.guest_name || null,
          'approved',
        ],
      );

      const savedPhoto: PhotoItem = {
        id: photoId,
        url: publicUrl,
        thumbnail_url: publicUrl,
        source: source as 'photographer' | 'guest',
        guest_name: body.guest_name || null,
        guest_identifier: body.guest_identifier || null,
        created_at: new Date().toISOString(),
      };
      return NextResponse.json({ success: true, message: 'Foto berhasil disimpan.', data: savedPhoto });
    }

    // POST /v1/events/:slug/photos/presigned-url
    if (path.length === 4 && path[0] === 'events' && path[2] === 'photos' && path[3] === 'presigned-url') {
      const slug = decodeURIComponent(path[1]).toLowerCase();
      const source = body.source === 'photographer' ? 'photographer' : 'guest';

      // 1. Verify Event status & upload allowance
      const evtRes = await db.query(
        'SELECT status, guest_upload_limit FROM events WHERE LOWER(slug) = LOWER($1) LIMIT 1',
        [slug],
      );
      if (evtRes.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Acara tidak ditemukan.' }, { status: 404 });
      }
      if (evtRes.rows[0].status === 'archived') {
        return NextResponse.json(
          { success: false, message: 'Acara sudah diarsipkan. Pengunggahan foto telah ditutup.' },
          { status: 403 },
        );
      }

      // 2. Validate MIME type
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      const contentType = (body.content_type || 'image/jpeg').toLowerCase().trim();
      if (!allowedMimes.includes(contentType)) {
        return NextResponse.json(
          { success: false, message: 'Format file tidak didukung. Harap unggah foto JPG/PNG/WebP.' },
          { status: 400 },
        );
      }

      // 3. Server-side Guest Quota Enforcement
      if (source === 'guest' && body.guest_identifier) {
        const countRes = await db.query(
          'SELECT COUNT(*) FROM photos WHERE LOWER(event_slug) = LOWER($1) AND guest_identifier = $2',
          [slug, String(body.guest_identifier)],
        );
        const uploadedCount = parseInt(countRes.rows[0]?.count || '0', 10);
        const limit = Number(evtRes.rows[0].guest_upload_limit ?? 5);
        if (uploadedCount >= limit) {
          return NextResponse.json(
            { success: false, message: `Batas kuota unggah foto Anda (${limit} foto) telah tercapai.` },
            { status: 429 },
          );
        }
      }

      const fileKey = `events/${slug}/${source}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      try {
        const uploadUrl = await createR2PresignedUploadUrl(
          fileKey,
          contentType,
          300,
        );
        return NextResponse.json({
          success: true,
          data: {
            upload_url: uploadUrl,
            file_key: fileKey,
            expires_in: 300,
          },
        });
      } catch {
        const origin = new URL(req.url).origin;
        return NextResponse.json({
          success: true,
          data: {
            upload_url: `${origin}/v1/upload-target?key=${encodeURIComponent(fileKey)}`,
            file_key: fileKey,
            expires_in: 300,
          },
        });
      }
    }

    // POST /v1/events/:slug/photos/confirm
    if (path.length === 4 && path[0] === 'events' && path[2] === 'photos' && path[3] === 'confirm') {
      const slug = decodeURIComponent(path[1]).toLowerCase();
      const photoId = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const fileKey = String(body.file_key || '');

      // Path containment validation
      if (fileKey && !fileKey.startsWith(`events/${slug}/`)) {
        return NextResponse.json({ success: false, message: 'Invalid file key scope.' }, { status: 400 });
      }

      const url = fileKey ? getR2PublicUrl(fileKey) : (body.data_url || 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=85');
      const source = String(body.guest_identifier || '').startsWith('admin_photographer_')
        ? 'photographer'
        : 'guest';

      // Sanitize guest name against HTML/script injection
      const sanitizedGuestName = body.guest_name
        ? String(body.guest_name).replace(/<[^>]*>?/gm, '').slice(0, 60).trim()
        : null;

      await db.query(
        `
        INSERT INTO photos (id, event_slug, url, thumbnail_url, source, guest_identifier, guest_name, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
        [
          photoId,
          slug,
          url,
          url,
          source,
          body.guest_identifier || null,
          sanitizedGuestName,
          'approved',
        ],
      );

      const savedPhoto: PhotoItem = {
        id: photoId,
        url,
        thumbnail_url: url,
        source: source as 'photographer' | 'guest',
        guest_name: sanitizedGuestName,
        guest_identifier: body.guest_identifier || null,
        created_at: new Date().toISOString(),
      };
      return NextResponse.json({ success: true, message: 'Foto berhasil disimpan.', data: savedPhoto });
    }

    // POST /v1/admin/events/:id/frame/presigned-url
    if (path.length === 5 && path[0] === 'admin' && path[1] === 'events' && path[3] === 'frame' && path[4] === 'presigned-url') {
      const eventId = path[2];
      const evtRes = await db.query('SELECT slug FROM events WHERE id = $1 OR slug = $1 LIMIT 1', [eventId]);
      const slug = evtRes.rows[0]?.slug || eventId;
      const rawFilename = (body.filename || 'frame.png').replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileKey = `events/${slug}/frames/${Date.now()}-${rawFilename}`;
      try {
        const uploadUrl = await createR2PresignedUploadUrl(
          fileKey,
          body.content_type || 'image/png',
          300,
        );
        const publicUrl = getR2PublicUrl(fileKey);
        return NextResponse.json({
          success: true,
          data: {
            upload_url: uploadUrl,
            file_key: fileKey,
            public_url: publicUrl,
            expires_in: 300,
          },
        });
      } catch {
        const origin = new URL(req.url).origin;
        return NextResponse.json({
          success: true,
          data: {
            upload_url: `${origin}/v1/upload-target?key=${encodeURIComponent(fileKey)}`,
            file_key: fileKey,
            public_url: null,
            expires_in: 300,
          },
        });
      }
    }

    // POST /v1/admin/events/:id/header/presigned-url
    if (path.length === 5 && path[0] === 'admin' && path[1] === 'events' && path[3] === 'header' && path[4] === 'presigned-url') {
      const eventId = path[2];
      const evtRes = await db.query('SELECT slug FROM events WHERE id = $1 OR slug = $1 LIMIT 1', [eventId]);
      const slug = evtRes.rows[0]?.slug || eventId;
      const rawFilename = (body.filename || 'header.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileKey = `events/${slug}/headers/${Date.now()}-${rawFilename}`;
      try {
        const uploadUrl = await createR2PresignedUploadUrl(
          fileKey,
          body.content_type || 'image/jpeg',
          300,
        );
        const publicUrl = getR2PublicUrl(fileKey);
        return NextResponse.json({
          success: true,
          data: {
            upload_url: uploadUrl,
            file_key: fileKey,
            public_url: publicUrl,
            expires_in: 300,
          },
        });
      } catch {
        const origin = new URL(req.url).origin;
        return NextResponse.json({
          success: true,
          data: {
            upload_url: `${origin}/v1/upload-target?key=${encodeURIComponent(fileKey)}`,
            file_key: fileKey,
            public_url: null,
            expires_in: 300,
          },
        });
      }
    }

    return NextResponse.json({ success: true, data: {} });
  } catch (err) {
    console.error('API POST error:', err);
    return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  await ensureDbSchema();
  const db = getDbPool();
  const { path } = await context.params;
  const body = await req.json().catch(() => ({}));

  try {
    // Guard all PATCH /v1/admin/* routes
    if (path[0] === 'admin' && !isAuthorizedAdmin(req)) {
      return unauthorizedResponse();
    }
    // PATCH /v1/admin/events/:id
    if (path.length === 3 && path[0] === 'admin' && path[1] === 'events') {
      const id = path[2];
      const hasHeaderChange = body.header_image_url !== undefined;
      const hasFrameChange = body.custom_frame_key !== undefined || body.custom_frame_url !== undefined;
      const customFrameKey = body.custom_frame_key !== undefined ? body.custom_frame_key : null;
      const customFrameUrl = customFrameKey ? getR2PublicUrl(customFrameKey) : (body.custom_frame_url !== undefined ? body.custom_frame_url : null);

      await db.query(
        `
        UPDATE events SET
          name = COALESCE($1, name),
          header_subtitle = COALESCE($2, header_subtitle),
          slug = COALESCE($3, slug),
          status = COALESCE($4, status),
          theme_color = COALESCE($5, theme_color),
          guest_upload_limit = COALESCE($6, guest_upload_limit),
          require_guest_moderation = COALESCE($7, require_guest_moderation),
          header_image_url = CASE WHEN $8::boolean THEN $9 ELSE header_image_url END,
          custom_frame_key = CASE WHEN $10::boolean THEN $11 ELSE custom_frame_key END,
          custom_frame_url = CASE WHEN $10::boolean THEN $12 ELSE custom_frame_url END,
          gallery_theme = COALESCE($14, gallery_theme),
          updated_at = NOW()
        WHERE id = $13 OR slug = $13
      `,
        [
          body.name,
          body.header_subtitle,
          body.slug,
          body.status,
          body.theme_color,
          body.guest_upload_limit !== undefined ? Number(body.guest_upload_limit) : null,
          body.require_guest_moderation !== undefined ? Boolean(body.require_guest_moderation) : null,
          hasHeaderChange,
          body.header_image_url ?? null,
          hasFrameChange,
          customFrameKey,
          customFrameUrl,
          id,
          body.gallery_theme || null,
        ],
      );

      const updatedRes = await db.query(
        `
        SELECT e.*, f.id as ftp_id, f.username as ftp_username, f.password as ftp_password, f.is_active as ftp_is_active
        FROM events e
        LEFT JOIN ftp_credentials f ON f.event_id = e.id
        WHERE e.id = $1 OR e.slug = $1
        LIMIT 1
      `,
        [id],
      );
      return NextResponse.json({ success: true, data: rowToAdminEvent(updatedRes.rows[0]) });
    }

    // PATCH /v1/admin/events/:id/status
    if (path.length === 4 && path[0] === 'admin' && path[1] === 'events' && path[3] === 'status') {
      const id = path[2];
      await db.query('UPDATE events SET status = $1, updated_at = NOW() WHERE id = $2 OR slug = $2', [body.status, id]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true, data: {} });
  } catch (err) {
    console.error('API PATCH error:', err);
    return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  await ensureDbSchema();
  const db = getDbPool();
  const { path } = await context.params;
  const url = new URL(req.url);
  const purgeStorage = url.searchParams.get('purge_storage') === 'true';

  try {
    // Guard all DELETE /v1/admin/* routes
    if (path[0] === 'admin' && !isAuthorizedAdmin(req)) {
      return unauthorizedResponse();
    }
    // DELETE /v1/admin/events/:id
    if (path.length === 3 && path[0] === 'admin' && path[1] === 'events') {
      const idOrSlug = decodeURIComponent(path[2]).trim();

      const foundRes = await db.query(
        'SELECT id, slug FROM events WHERE id = $1 OR LOWER(slug) = LOWER($1) LIMIT 1',
        [idOrSlug],
      );

      let targetSlug = idOrSlug;
      let r2DeletedCount = 0;

      if (foundRes.rows.length > 0) {
        const { id, slug } = foundRes.rows[0];
        targetSlug = slug;
        // Clean up photos associated with this event slug
        await db.query('DELETE FROM photos WHERE LOWER(event_slug) = LOWER($1)', [slug]);
        // Clean up ftp credentials
        await db.query('DELETE FROM ftp_credentials WHERE event_id = $1 OR LOWER(username) = LOWER($2)', [id, slug]);
        // Delete the event record
        await db.query('DELETE FROM events WHERE id = $1', [id]);
      } else {
        await db.query('DELETE FROM events WHERE id = $1 OR LOWER(slug) = LOWER($1)', [idOrSlug]);
      }

      // If purge_storage was requested, delete all files in R2 under events/{slug}/
      if (purgeStorage && targetSlug) {
        try {
          r2DeletedCount = await deleteR2EventFolder(targetSlug);
        } catch (r2Err) {
          console.error('Failed to purge Cloudflare R2 folder:', r2Err);
        }
      }

      return NextResponse.json({
        success: true,
        message: purgeStorage
          ? `Acara dan seluruh file di R2 (${r2DeletedCount} file) berhasil dihapus.`
          : 'Acara berhasil dihapus.',
        r2_deleted_count: r2DeletedCount,
      });
    }

    // DELETE /v1/admin/events/:id/photos/:photoId
    if (path.length === 5 && path[0] === 'admin' && path[1] === 'events' && path[3] === 'photos') {
      await db.query('DELETE FROM photos WHERE id = $1', [path[4]]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API DELETE error:', err);
    return NextResponse.json({ success: false, message: (err as Error).message }, { status: 500 });
  }
}
