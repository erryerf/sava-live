import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_DEMO_ADMIN_EVENTS } from '@/components/admin/demo-data';
import { DEMO_PHOTOS } from '@/components/guest/guestGalleryConstants';
import { AdminEvent, PhotoItem } from '@/lib/types';

interface ServerStore {
  events: AdminEvent[];
  photosBySlug: Record<string, PhotoItem[]>;
  pendingUploads: Record<string, { slug: string; dataUrl?: string }>;
}

const globalForSava = globalThis as unknown as {
  __savaServerStore?: ServerStore;
};

function getStore(): ServerStore {
  if (!globalForSava.__savaServerStore) {
    const initialPhotos: Record<string, PhotoItem[]> = {
      'budi-ani': [...DEMO_PHOTOS.photographer, ...DEMO_PHOTOS.guest],
    };
    globalForSava.__savaServerStore = {
      events: [...INITIAL_DEMO_ADMIN_EVENTS],
      photosBySlug: initialPhotos,
      pendingUploads: {},
    };
  }
  return globalForSava.__savaServerStore;
}

function toPublicEvent(evt: AdminEvent) {
  return {
    id: evt.id,
    name: evt.name,
    header_subtitle: evt.header_subtitle ?? 'The Wedding of',
    slug: evt.slug,
    status: evt.status,
    theme_color: evt.theme_color,
    header_image_url: evt.header_image_url ?? null,
    custom_frame_url: evt.custom_frame_url ?? null,
    guest_upload_limit: Number(evt.guest_upload_limit ?? 5),
    is_upload_allowed: evt.status === 'active',
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const store = getStore();
  const url = new URL(req.url);

  // GET /v1/admin/events
  if (path.length === 2 && path[0] === 'admin' && path[1] === 'events') {
    const status = url.searchParams.get('status');
    const data = status
      ? store.events.filter((e) => e.status === status)
      : store.events;
    return NextResponse.json({ success: true, data });
  }

  // GET /v1/admin/events/:id
  if (path.length === 3 && path[0] === 'admin' && path[1] === 'events') {
    const evt = store.events.find((e) => e.id === path[2]);
    if (!evt) {
      return NextResponse.json(
        { success: false, message: 'Event tidak ditemukan.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: evt });
  }

  // GET /v1/admin/events/:id/photos
  if (
    path.length === 4 &&
    path[0] === 'admin' &&
    path[1] === 'events' &&
    path[3] === 'photos'
  ) {
    const evt = store.events.find((e) => e.id === path[2]);
    if (!evt) {
      return NextResponse.json({ success: true, data: [] });
    }
    const list = store.photosBySlug[evt.slug] || [];
    return NextResponse.json({ success: true, data: list });
  }

  // GET /v1/events/:slug
  if (path.length === 2 && path[0] === 'events') {
    const slug = decodeURIComponent(path[1]).toLowerCase();
    const evt = store.events.find((e) => e.slug.toLowerCase() === slug);
    if (!evt) {
      return NextResponse.json(
        { success: false, message: 'Acara tidak ditemukan.' },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: toPublicEvent(evt) });
  }

  // GET /v1/events/:slug/photos
  if (path.length === 3 && path[0] === 'events' && path[2] === 'photos') {
    const slug = decodeURIComponent(path[1]).toLowerCase();
    const source = url.searchParams.get('source');
    const allPhotos = store.photosBySlug[slug] || [];
    const filtered = allPhotos.filter(
      (p) =>
        p.status !== 'rejected' &&
        p.status !== 'pending' &&
        (!source || p.source === source),
    );
    return NextResponse.json({
      success: true,
      meta: { next_cursor: null, has_more: false },
      data: filtered,
    });
  }

  // GET /v1/events/:slug/archive
  if (path.length === 3 && path[0] === 'events' && path[2] === 'archive') {
    const slug = decodeURIComponent(path[1]).toLowerCase();
    const evt = store.events.find((e) => e.slug.toLowerCase() === slug);
    return NextResponse.json({
      success: true,
      data: {
        status: evt?.archive_status || 'ready',
        download_url:
          evt?.archive_download_url ||
          `https://sava-app.cloud/v1/events/${slug}/archive-download`,
      },
    });
  }

  return NextResponse.json(
    { success: false, message: 'Endpoint tidak ditemukan.' },
    { status: 404 },
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const store = getStore();
  const body = await req.json().catch(() => ({}));

  // POST /v1/admin/events/sync (sync client localStorage events to server)
  if (
    path.length === 3 &&
    path[0] === 'admin' &&
    path[1] === 'events' &&
    path[2] === 'sync'
  ) {
    const clientEvents = Array.isArray(body.events)
      ? (body.events as AdminEvent[])
      : [];
    for (const item of clientEvents) {
      if (!item?.slug) continue;
      const idx = store.events.findIndex(
        (e) =>
          e.id === item.id || e.slug.toLowerCase() === item.slug.toLowerCase(),
      );
      if (idx >= 0) {
        store.events[idx] = {
          ...store.events[idx],
          ...item,
          guest_upload_limit: Number(
            item.guest_upload_limit ?? store.events[idx].guest_upload_limit ?? 5,
          ),
        };
      } else {
        store.events.unshift({
          ...item,
          guest_upload_limit: Number(item.guest_upload_limit ?? 5),
        });
      }
    }
    return NextResponse.json({ success: true, data: store.events });
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

    const newEvent: AdminEvent = {
      id: `evt-${Date.now()}`,
      name: String(body.name || 'Acara Baru'),
      header_subtitle: body.header_subtitle ?? 'The Wedding of',
      slug,
      status: body.status || 'active',
      theme_color: body.theme_color || '#D4AF37',
      header_image_url: body.header_image_url || null,
      guest_upload_limit: Number(body.guest_upload_limit ?? 5),
      is_upload_allowed: (body.status || 'active') === 'active',
      start_time: body.start_time || new Date().toISOString(),
      end_time: body.end_time || new Date(Date.now() + 21600000).toISOString(),
      custom_frame_key: body.custom_frame_key || null,
      custom_frame_url: null,
      require_guest_moderation: Boolean(body.require_guest_moderation),
      archive_zip_key: null,
      archive_download_url: null,
      archive_status: 'none',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ftp_status: {
        connected: false,
        active_sessions: 0,
        last_connected_at: null,
        last_upload_at: null,
      },
      ftp_credentials: {
        id: `ftp-${Date.now()}`,
        username: slug,
        password: Math.random().toString(36).slice(2, 10),
        is_active: true,
        created_at: new Date().toISOString(),
      },
    };

    const existingIdx = store.events.findIndex(
      (e) => e.slug.toLowerCase() === slug,
    );
    if (existingIdx >= 0) {
      store.events[existingIdx] = newEvent;
    } else {
      store.events.unshift(newEvent);
    }
    return NextResponse.json({ success: true, data: newEvent }, { status: 201 });
  }

  // POST /v1/admin/events/:id/ftp-password/reset
  if (
    path.length === 5 &&
    path[0] === 'admin' &&
    path[1] === 'events' &&
    path[3] === 'ftp-password' &&
    path[4] === 'reset'
  ) {
    const evt = store.events.find((e) => e.id === path[2]);
    const newPassword = Math.random().toString(36).slice(2, 10);
    if (evt && evt.ftp_credentials) {
      evt.ftp_credentials.password = newPassword;
    }
    return NextResponse.json({
      success: true,
      data: {
        username: evt?.slug || 'event',
        password: newPassword,
        is_active: true,
      },
    });
  }

  // POST /v1/admin/events/:id/archive
  if (
    path.length === 4 &&
    path[0] === 'admin' &&
    path[1] === 'events' &&
    path[3] === 'archive'
  ) {
    const evt = store.events.find((e) => e.id === path[2]);
    if (evt) {
      evt.archive_status = 'ready';
      evt.archive_download_url = `https://sava-app.cloud/v1/events/${evt.slug}/archive`;
    }
    return NextResponse.json({
      success: true,
      message: 'Arsip ZIP berhasil disiapkan.',
    });
  }

  // POST /v1/events/:slug/photos/presigned-url
  if (
    path.length === 4 &&
    path[0] === 'events' &&
    path[2] === 'photos' &&
    path[3] === 'presigned-url'
  ) {
    const slug = decodeURIComponent(path[1]).toLowerCase();
    const fileKey = `events/${slug}/guest/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
    const origin = new URL(req.url).origin;
    store.pendingUploads[fileKey] = { slug };
    return NextResponse.json({
      success: true,
      data: {
        upload_url: `${origin}/v1/upload-target?key=${encodeURIComponent(fileKey)}`,
        file_key: fileKey,
        expires_in: 300,
      },
    });
  }

  // POST /v1/events/:slug/photos/confirm
  if (
    path.length === 4 &&
    path[0] === 'events' &&
    path[2] === 'photos' &&
    path[3] === 'confirm'
  ) {
    const slug = decodeURIComponent(path[1]).toLowerCase();
    const fileKey = String(body.file_key || '');
    const pending = store.pendingUploads[fileKey];
    const evt = store.events.find((e) => e.slug.toLowerCase() === slug);

    const newPhoto: PhotoItem = {
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url:
        pending?.dataUrl ||
        body.data_url ||
        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=85',
      source: String(body.guest_identifier || '').startsWith(
        'admin_photographer_',
      )
        ? 'photographer'
        : 'guest',
      guest_name: body.guest_name || null,
      status: evt?.require_guest_moderation ? 'pending' : 'approved',
      created_at: new Date().toISOString(),
    };

    if (!store.photosBySlug[slug]) {
      store.photosBySlug[slug] = [];
    }
    store.photosBySlug[slug].unshift(newPhoto);
    delete store.pendingUploads[fileKey];

    return NextResponse.json({
      success: true,
      message: 'Foto berhasil disimpan.',
      data: newPhoto,
    });
  }

  return NextResponse.json({ success: true, data: {} });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const store = getStore();
  const url = new URL(req.url);

  // PUT /v1/upload-target?key=...
  if (path.length === 1 && path[0] === 'upload-target') {
    const fileKey = url.searchParams.get('key') || '';
    const arrayBuffer = await req.arrayBuffer();
    const contentType = req.headers.get('content-type') || 'image/jpeg';
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;
    if (fileKey) {
      store.pendingUploads[fileKey] = {
        slug: store.pendingUploads[fileKey]?.slug || '',
        dataUrl,
      };
    }
    return new NextResponse(null, { status: 200 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const store = getStore();
  const body = await req.json().catch(() => ({}));

  // PATCH /v1/admin/events/:id
  if (path.length === 3 && path[0] === 'admin' && path[1] === 'events') {
    const idx = store.events.findIndex(
      (e) => e.id === path[2] || e.slug === body.slug,
    );
    if (idx === -1) {
      return NextResponse.json(
        { success: false, message: 'Event tidak ditemukan.' },
        { status: 404 },
      );
    }

    const updated: AdminEvent = {
      ...store.events[idx],
      ...body,
      guest_upload_limit:
        body.guest_upload_limit !== undefined
          ? Number(body.guest_upload_limit)
          : store.events[idx].guest_upload_limit,
      is_upload_allowed:
        (body.status || store.events[idx].status) === 'active',
      updated_at: new Date().toISOString(),
    };
    store.events[idx] = updated;
    return NextResponse.json({ success: true, data: updated });
  }

  // PATCH /v1/admin/events/:id/status
  if (
    path.length === 4 &&
    path[0] === 'admin' &&
    path[1] === 'events' &&
    path[3] === 'status'
  ) {
    const evt = store.events.find((e) => e.id === path[2]);
    if (!evt) {
      return NextResponse.json(
        { success: false, message: 'Event tidak ditemukan.' },
        { status: 404 },
      );
    }
    evt.status = body.status;
    evt.is_upload_allowed = body.status === 'active';
    return NextResponse.json({ success: true, data: evt });
  }

  // PATCH /v1/admin/events/:id/photos/:photoId/status
  if (
    path.length === 6 &&
    path[0] === 'admin' &&
    path[1] === 'events' &&
    path[3] === 'photos' &&
    path[5] === 'status'
  ) {
    const evt = store.events.find((e) => e.id === path[2]);
    if (evt && store.photosBySlug[evt.slug]) {
      const photo = store.photosBySlug[evt.slug].find((p) => p.id === path[4]);
      if (photo) {
        photo.status = body.status;
        return NextResponse.json({ success: true, data: photo });
      }
    }
    return NextResponse.json({ success: true, data: {} });
  }

  return NextResponse.json({ success: true, data: {} });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const store = getStore();

  // DELETE /v1/admin/events/:id
  if (path.length === 3 && path[0] === 'admin' && path[1] === 'events') {
    store.events = store.events.filter((e) => e.id !== path[2]);
    return NextResponse.json({ success: true });
  }

  // DELETE /v1/admin/events/:id/photos/:photoId
  if (
    path.length === 5 &&
    path[0] === 'admin' &&
    path[1] === 'events' &&
    path[3] === 'photos'
  ) {
    const evt = store.events.find((e) => e.id === path[2]);
    if (evt && store.photosBySlug[evt.slug]) {
      store.photosBySlug[evt.slug] = store.photosBySlug[evt.slug].filter(
        (p) => p.id !== path[4],
      );
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}
