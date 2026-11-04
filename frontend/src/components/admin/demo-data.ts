import { getLocalEventCustomization } from '@/lib/api';
import { AdminEvent, PhotoItem } from '@/lib/types';

export const DEMO_EVENTS_STORAGE_KEY = 'sava_demo_admin_events';

export const INITIAL_DEMO_ADMIN_EVENTS: AdminEvent[] = [
  {
    id: 'demo-evt-1',
    name: 'Budi & Ani',
    header_subtitle: 'The Wedding of',
    slug: 'budi-ani',
    status: 'active',
    theme_color: '#D4AF37',
    header_image_url:
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=80',
    guest_upload_limit: 5,
    is_upload_allowed: true,
    start_time: new Date(Date.now() - 3600000 * 2).toISOString(),
    end_time: new Date(Date.now() + 3600000 * 6).toISOString(),
    custom_frame_key: null,
    custom_frame_url: null,
    require_guest_moderation: true,
    archive_zip_key: null,
    archive_download_url: null,
    archive_status: 'none',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ftp_status: {
      connected: true,
      active_sessions: 1,
      last_connected_at: new Date().toISOString(),
      last_upload_at: new Date(Date.now() - 45000).toISOString(),
    },
    ftp_credentials: {
      id: 'ftp-1',
      username: 'budi-ani',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  },
  {
    id: 'demo-evt-2',
    name: 'Gala Dinner SAVA Corp 2026',
    header_subtitle: 'Corporate Night',
    slug: 'sava-gala-2026',
    status: 'archived',
    theme_color: '#38BDF8',
    guest_upload_limit: 5,
    is_upload_allowed: false,
    start_time: new Date(Date.now() - 86400000 * 3).toISOString(),
    end_time: new Date(Date.now() - 86400000 * 2).toISOString(),
    custom_frame_key: 'events/sava-gala-2026/frames/frame.png',
    custom_frame_url: null,
    require_guest_moderation: false,
    archive_zip_key: 'events/sava-gala-2026/archives/sava-gala-2026-all.zip',
    archive_download_url:
      'https://cdn.domainanda.com/events/sava-gala-2026/archives/sava-gala-2026-all.zip',
    archive_status: 'ready',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    ftp_status: {
      connected: false,
      active_sessions: 0,
      last_connected_at: null,
      last_upload_at: null,
    },
    ftp_credentials: {
      id: 'ftp-2',
      username: 'sava-gala-2026',
      is_active: false,
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
  },
];

export const DEMO_ADMIN_PHOTOS: PhotoItem[] = [
  {
    id: 'adm-photo-1',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80',
    source: 'photographer',
    guest_name: null,
    status: 'approved',
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'adm-photo-2',
    url: 'https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=80',
    source: 'guest',
    guest_name: 'Rangga',
    status: 'approved',
    created_at: new Date(Date.now() - 240000).toISOString(),
  },
  {
    id: 'adm-photo-3',
    url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=900&q=80',
    source: 'guest',
    guest_name: 'Kevin',
    status: 'pending',
    created_at: new Date(Date.now() - 60000).toISOString(),
  },
];

export function getStoredDemoEvents(): AdminEvent[] {
  if (typeof window === 'undefined') return INITIAL_DEMO_ADMIN_EVENTS;
  try {
    const raw = window.localStorage.getItem(DEMO_EVENTS_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(
        DEMO_EVENTS_STORAGE_KEY,
        JSON.stringify(INITIAL_DEMO_ADMIN_EVENTS),
      );
      return INITIAL_DEMO_ADMIN_EVENTS;
    }
    const parsed = JSON.parse(raw) as AdminEvent[];
    return parsed.map((evt) => {
      const custom = getLocalEventCustomization(evt.slug);
      return {
        ...evt,
        name: custom?.name || evt.name,
        header_subtitle:
          custom?.header_subtitle !== undefined
            ? custom.header_subtitle
            : evt.header_subtitle,
        theme_color: custom?.theme_color || evt.theme_color,
        header_image_url:
          custom?.header_image_url !== undefined
            ? custom.header_image_url
            : evt.header_image_url,
        guest_upload_limit:
          typeof custom?.guest_upload_limit === 'number'
            ? custom.guest_upload_limit
            : evt.guest_upload_limit,
      };
    });
  } catch {
    return INITIAL_DEMO_ADMIN_EVENTS;
  }
}

export function saveStoredDemoEvents(list: AdminEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEMO_EVENTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors
  }
}

