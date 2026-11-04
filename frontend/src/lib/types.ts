export type PhotoSource = 'photographer' | 'guest';
export type EventStatus = 'draft' | 'active' | 'archived';
export type ArchiveStatus = 'none' | 'processing' | 'ready' | 'failed';
export type PhotoStatus = 'pending' | 'approved' | 'rejected';

export interface PublicEvent {
  id: string;
  name: string;
  header_subtitle?: string | null;
  slug: string;
  status: EventStatus;
  theme_color: string;
  header_image_url?: string | null;
  guest_upload_limit: number;
  is_upload_allowed: boolean;
}

export interface PhotoItem {
  id: string;
  url: string;
  thumbnail_url?: string | null;
  original_url?: string | null;
  source: PhotoSource;
  guest_name: string | null;
  status?: PhotoStatus;
  created_at: string;
}

export interface PaginatedPhotosResponse {
  success: boolean;
  meta: {
    next_cursor: string | null;
    has_more: boolean;
  };
  data: PhotoItem[];
}

export interface PresignedUrlResponse {
  success: boolean;
  data: {
    upload_url: string;
    file_key: string;
  };
}

export interface ArchiveStatusResponse {
  success: boolean;
  data: {
    status: ArchiveStatus;
    download_url: string | null;
  };
}

export interface AdminEvent extends PublicEvent {
  start_time: string;
  end_time: string;
  header_image_key?: string | null;
  custom_frame_key: string | null;
  custom_frame_url: string | null;
  require_guest_moderation: boolean;
  archive_zip_key: string | null;
  archive_download_url: string | null;
  archive_status: ArchiveStatus;
  created_at: string;
  updated_at: string;
  ftp_status?: {
    connected: boolean;
    active_sessions: number;
    last_connected_at: string | null;
    last_upload_at: string | null;
  };
  ftp_credentials?: {
    id: string;
    username: string;
    password?: string;
    is_active: boolean;
    created_at: string;
  };
}
