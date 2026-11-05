export const PHOTO_PROCESSING_QUEUE = 'photo_processing_queue';
export const ARCHIVE_QUEUE = 'archive_queue';

export interface FtpPhotoJobPayload {
  jobType?: 'ftp_upload';
  eventSlug: string;
  tempFilePath: string;
}

export interface GuestPhotoJobPayload {
  jobType: 'guest_upload';
  eventSlug: string;
  photoId: string;
  fileKey: string;
  guestName?: string | null;
}

export type PhotoProcessingJobPayload =
  | FtpPhotoJobPayload
  | GuestPhotoJobPayload;

export interface ArchiveJobPayload {
  event_id: string;
  slug: string;
}

export interface NewPhotoBroadcastPayload {
  id: string;
  url: string | null;
  source: 'photographer' | 'guest';
  guest_name: string | null;
  guest_identifier?: string | null;
  created_at: string;
}

