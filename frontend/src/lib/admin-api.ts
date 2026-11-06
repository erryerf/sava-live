import { API_BASE_URL, uploadFileToPresignedUrl } from './api';
import {
  AdminEvent,
  EventStatus,
  PhotoItem,
  PhotoSource,
  PhotoStatus,
} from './types';

const TOKEN_STORAGE_KEY = 'sava_admin_token';

export function getAdminToken(): string {
  if (typeof window === 'undefined') return 'sava-admin-secret-token-2026';
  return (
    window.localStorage.getItem(TOKEN_STORAGE_KEY) ||
    'sava-admin-secret-token-2026'
  );
}

export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getAdminToken()}`,
  };
}

export async function adminLogin(
  email: string,
  password: string,
): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
  const res = await fetch(`${API_BASE_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Login gagal. Periksa email & password.');
  }
  if (json.data?.token) {
    setAdminToken(json.data.token);
  }
  return json.data;
}

export async function fetchAdminEvents(
  status?: EventStatus,
): Promise<AdminEvent[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_BASE_URL}/admin/events${query}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Gagal memuat daftar event.');
  }
  const json = await res.json();
  return (json.data || []) as AdminEvent[];
}

export async function fetchAdminEventById(id: string): Promise<AdminEvent> {
  const res = await fetch(`${API_BASE_URL}/admin/events/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Event tidak ditemukan.');
  }
  return json.data as AdminEvent;
}

export async function createAdminEvent(payload: {
  name: string;
  header_subtitle?: string;
  slug?: string;
  start_time: string;
  end_time: string;
  theme_color: string;
  guest_upload_limit: number;
  require_guest_moderation: boolean;
  header_image_key?: string;
  custom_frame_key?: string;
  status?: EventStatus;
  gallery_theme?: 'dark' | 'light';
}): Promise<AdminEvent> {
  const res = await fetch(`${API_BASE_URL}/admin/events`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(json.message)
      ? json.message[0]
      : json.message || 'Gagal membuat event baru.';
    throw new Error(msg);
  }
  return json.data as AdminEvent;
}

export async function updateAdminEvent(
  id: string,
  payload: Partial<{
    name: string;
    header_subtitle: string | null;
    slug: string;
    start_time: string;
    end_time: string;
    theme_color: string;
    guest_upload_limit: number;
    require_guest_moderation: boolean;
    header_image_key: string | null;
    custom_frame_key: string | null;
    status: EventStatus;
    gallery_theme?: 'dark' | 'light';
  }>,
): Promise<AdminEvent> {
  const res = await fetch(`${API_BASE_URL}/admin/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Gagal memperbarui pengaturan event.');
  }
  return json.data as AdminEvent;
}

export async function updateAdminEventStatus(
  id: string,
  status: EventStatus,
): Promise<AdminEvent> {
  const res = await fetch(
    `${API_BASE_URL}/admin/events/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Gagal mengubah status event.');
  }
  return json.data as AdminEvent;
}

export async function deleteAdminEvent(
  id: string,
  purgeStorage: boolean = false,
): Promise<{ success: boolean; message?: string; r2_deleted_count?: number }> {
  const query = purgeStorage ? '?purge_storage=true' : '';
  const res = await fetch(
    `${API_BASE_URL}/admin/events/${encodeURIComponent(id)}${query}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Gagal menghapus event.');
  }
  return json;
}

export async function triggerAdminArchive(
  id: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(
    `${API_BASE_URL}/admin/events/${encodeURIComponent(id)}/archive`,
    {
      method: 'POST',
      headers: authHeaders(),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Gagal memicu pembuatan arsip ZIP.');
  }
  return json;
}

export async function resetAdminFtpPassword(id: string): Promise<{
  username: string;
  password: string;
  is_active: boolean;
}> {
  const res = await fetch(
    `${API_BASE_URL}/admin/events/${encodeURIComponent(id)}/ftp-password/reset`,
    {
      method: 'POST',
      headers: authHeaders(),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Gagal mereset password FTP.');
  }
  return json.data;
}

export async function uploadAdminHeaderImage(
  eventId: string,
  file: File,
): Promise<{ file_key: string; public_url: string | null }> {
  const res = await fetch(
    `${API_BASE_URL}/admin/events/${encodeURIComponent(eventId)}/header/presigned-url`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type || 'image/jpeg',
      }),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Gagal meminta URL unggah foto header.');
  }

  await uploadFileToPresignedUrl(json.data.upload_url, file);
  await updateAdminEvent(eventId, { header_image_key: json.data.file_key });
  return {
    file_key: json.data.file_key,
    public_url: json.data.public_url,
  };
}

export async function uploadAdminCustomFrame(
  eventId: string,
  file: File,
): Promise<{ file_key: string; public_url: string | null }> {
  const res = await fetch(
    `${API_BASE_URL}/admin/events/${encodeURIComponent(eventId)}/frame/presigned-url`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type || 'image/png',
      }),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Gagal meminta URL unggah frame.');
  }

  await uploadFileToPresignedUrl(json.data.upload_url, file);
  await updateAdminEvent(eventId, { custom_frame_key: json.data.file_key });
  return {
    file_key: json.data.file_key,
    public_url: json.data.public_url,
  };
}

export async function fetchAdminEventPhotos(
  eventId: string,
  options: { source?: PhotoSource; status?: PhotoStatus } = {},
): Promise<PhotoItem[]> {
  const params = new URLSearchParams();
  if (options.source) params.set('source', options.source);
  if (options.status) params.set('status', options.status);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(
    `${API_BASE_URL}/admin/events/${encodeURIComponent(eventId)}/photos${qs}`,
    {
      headers: authHeaders(),
      cache: 'no-store',
    },
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || []) as PhotoItem[];
}

export async function moderateAdminPhoto(
  eventId: string,
  photoId: string,
  status: PhotoStatus,
): Promise<PhotoItem> {
  const res = await fetch(
    `${API_BASE_URL}/admin/events/${encodeURIComponent(eventId)}/photos/${encodeURIComponent(photoId)}/status`,
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Gagal memperbarui status foto.');
  }
  return json.data as PhotoItem;
}

export async function deleteAdminPhoto(
  eventId: string,
  photoId: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/admin/events/${encodeURIComponent(eventId)}/photos/${encodeURIComponent(photoId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    },
  );
  if (!res.ok) {
    throw new Error('Gagal menghapus foto.');
  }
}

export interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export async function fetchAdminUsers(): Promise<AdminUserItem[]> {
  const res = await fetch(`${API_BASE_URL}/admin/users`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || []) as AdminUserItem[];
}

export async function createAdminUser(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<AdminUserItem> {
  const res = await fetch(`${API_BASE_URL}/admin/users`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Gagal menambah user admin.');
  }
  return json.data as AdminUserItem;
}

