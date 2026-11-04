import {
  ArchiveStatusResponse,
  PaginatedPhotosResponse,
  PhotoItem,
  PhotoSource,
  PresignedUrlResponse,
  PublicEvent,
} from './types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/v1';

export async function fetchPublicEvent(
  slug: string,
): Promise<PublicEvent | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/events/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as PublicEvent;
  } catch {
    return null;
  }
}

export async function fetchEventPhotos(
  slug: string,
  options: {
    limit?: number;
    cursor?: string | null;
    source?: PhotoSource;
  } = {},
): Promise<PaginatedPhotosResponse> {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 30));
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.source) params.set('source', options.source);

  const res = await fetch(
    `${API_BASE_URL}/events/${encodeURIComponent(slug)}/photos?${params.toString()}`,
    { cache: 'no-store' },
  );

  if (!res.ok) {
    return {
      success: false,
      meta: { next_cursor: null, has_more: false },
      data: [],
    };
  }

  return (await res.json()) as PaginatedPhotosResponse;
}

export async function requestGuestPresignedUrl(
  slug: string,
  payload: {
    filename: string;
    content_type: string;
    guest_identifier: string;
    source?: 'photographer' | 'guest';
  },
): Promise<PresignedUrlResponse['data']> {
  const res = await fetch(
    `${API_BASE_URL}/events/${encodeURIComponent(slug)}/photos/presigned-url`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Gagal meminta akses unggah.');
  }

  return json.data;
}

export async function uploadFileToPresignedUrl(
  uploadUrl: string,
  file: File,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'image/jpeg',
    },
    body: file,
  });

  if (!res.ok) {
    throw new Error('Gagal mengunggah foto ke penyimpanan cloud.');
  }
}

export async function confirmGuestPhotoUpload(
  slug: string,
  payload: {
    file_key: string;
    guest_identifier: string;
    guest_name?: string;
  },
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(
    `${API_BASE_URL}/events/${encodeURIComponent(slug)}/photos/confirm`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Gagal mengonfirmasi foto.');
  }

  return json;
}

export async function fetchEventArchiveStatus(
  slug: string,
): Promise<ArchiveStatusResponse['data'] | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/events/${encodeURIComponent(slug)}/archive`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as ArchiveStatusResponse;
    return json.data;
  } catch {
    return null;
  }
}

export function getOrCreateGuestIdentifier(): string {
  if (typeof window === 'undefined') return 'guest-ssr';
  const storageKey = 'sava_guest_id';
  let id = window.localStorage.getItem(storageKey);
  if (!id) {
    id =
      'guest_' +
      Math.random().toString(36).substring(2, 10) +
      '_' +
      Date.now().toString(36);
    window.localStorage.setItem(storageKey, id);
  }
  return id;
}

export function getLocalGuestUploadCount(slug: string): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem(`sava_quota_${slug}`);
  const parsed = raw ? parseInt(raw, 10) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function incrementLocalGuestUploadCount(slug: string): number {
  if (typeof window === 'undefined') return 0;
  const next = getLocalGuestUploadCount(slug) + 1;
  window.localStorage.setItem(`sava_quota_${slug}`, String(next));
  return next;
}

export interface LocalEventCustomization {
  name?: string;
  header_subtitle?: string | null;
  theme_color?: string;
  header_image_url?: string | null;
  guest_upload_limit?: number;
  status?: PublicEvent['status'];
  is_upload_allowed?: boolean;
  require_guest_moderation?: boolean;
}

export function getLocalEventCustomization(
  slug: string,
): LocalEventCustomization | null {
  if (typeof window === 'undefined') return null;
  try {
    const customRaw = window.localStorage.getItem(`sava_event_custom_${slug}`);
    const customParsed = customRaw
      ? (JSON.parse(customRaw) as LocalEventCustomization)
      : null;

    const demoListRaw = window.localStorage.getItem('sava_demo_admin_events');
    let fromDemoList: LocalEventCustomization | null = null;
    if (demoListRaw) {
      const demoList = JSON.parse(demoListRaw) as Array<{
        slug?: string;
        name?: string;
        header_subtitle?: string | null;
        theme_color?: string;
        header_image_url?: string | null;
        guest_upload_limit?: number;
        status?: PublicEvent['status'];
        is_upload_allowed?: boolean;
        require_guest_moderation?: boolean;
      }>;
      const matched = demoList.find(
        (item) => item.slug?.toLowerCase() === slug.toLowerCase(),
      );
      if (matched) {
        fromDemoList = {
          name: matched.name,
          header_subtitle: matched.header_subtitle,
          theme_color: matched.theme_color,
          header_image_url: matched.header_image_url,
          guest_upload_limit:
            typeof matched.guest_upload_limit === 'number'
              ? matched.guest_upload_limit
              : undefined,
          status: matched.status,
          is_upload_allowed: matched.is_upload_allowed,
          require_guest_moderation: matched.require_guest_moderation,
        };
      }
    }

    if (!customParsed && !fromDemoList) return null;
    return {
      ...fromDemoList,
      ...customParsed,
      guest_upload_limit:
        typeof customParsed?.guest_upload_limit === 'number'
          ? customParsed.guest_upload_limit
          : fromDemoList?.guest_upload_limit,
    };
  } catch {
    return null;
  }
}

export function saveLocalEventCustomization(
  slug: string,
  patch: LocalEventCustomization,
): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalEventCustomization(slug) || {};
    const merged = { ...current, ...patch };
    window.localStorage.setItem(
      `sava_event_custom_${slug}`,
      JSON.stringify(merged),
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function getLocalEventPhotos(slug: string): PhotoItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`sava_event_photos_${slug}`);
    if (!raw) return [];
    return JSON.parse(raw) as PhotoItem[];
  } catch {
    return [];
  }
}

export function addLocalEventPhoto(slug: string, photo: PhotoItem): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalEventPhotos(slug);
    const updated = [photo, ...current.filter((p) => p.id !== photo.id)].slice(
      0,
      40,
    );
    window.localStorage.setItem(
      `sava_event_photos_${slug}`,
      JSON.stringify(updated),
    );
  } catch {
    // Ignore localStorage quota exceeded for large data URLs
  }

  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(`sava_live_${slug}`);
      bc.postMessage({ event: 'NEW_PHOTO', data: photo });
      bc.close();
    }
  } catch {
    // Ignore BroadcastChannel errors
  }
}

export function removeLocalEventPhoto(slug: string, photoId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalEventPhotos(slug);
    const updated = current.filter((p) => p.id !== photoId);
    window.localStorage.setItem(
      `sava_event_photos_${slug}`,
      JSON.stringify(updated),
    );
  } catch {
    // Ignore errors
  }

  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(`sava_live_${slug}`);
      bc.postMessage({ event: 'PHOTO_DELETED', data: { id: photoId } });
      bc.close();
    }
  } catch {
    // Ignore BroadcastChannel errors
  }
}

export function subscribeLocalLiveEvents(
  slug: string,
  handlers: {
    onNewPhoto?: (photo: PhotoItem) => void;
    onPhotoDeleted?: (photoId: string) => void;
  },
): () => void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return () => {};
  }
  const bc = new BroadcastChannel(`sava_live_${slug}`);
  bc.onmessage = (ev) => {
    const msg = ev.data as {
      event?: string;
      data?: PhotoItem & { id?: string };
    };
    if (msg?.event === 'NEW_PHOTO' && msg.data?.id && handlers.onNewPhoto) {
      handlers.onNewPhoto(msg.data as PhotoItem);
    } else if (
      msg?.event === 'PHOTO_DELETED' &&
      msg.data?.id &&
      handlers.onPhotoDeleted
    ) {
      handlers.onPhotoDeleted(msg.data.id);
    }
  };
  return () => {
    bc.close();
  };
}



