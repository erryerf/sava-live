import { PhotoItem, PhotoSource } from '@/lib/types';

export interface CapturedShot {
  id: string;
  file: File;
  previewUrl: string;
}

export const DEFAULT_DEMO_HEADER_PHOTO =
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=80';

export const DEMO_PHOTOS: Record<PhotoSource, PhotoItem[]> = {
  photographer: [
    {
      id: 'demo-main-1',
      url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=85',
      source: 'photographer',
      guest_name: null,
      created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    },
    {
      id: 'demo-main-2',
      url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=900&q=85',
      source: 'photographer',
      guest_name: null,
      created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      id: 'demo-main-3',
      url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=900&q=85',
      source: 'photographer',
      guest_name: null,
      created_at: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
    },
    {
      id: 'demo-main-4',
      url: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=900&q=85',
      source: 'photographer',
      guest_name: null,
      created_at: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    },
    {
      id: 'demo-main-5',
      url: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=900&q=85',
      source: 'photographer',
      guest_name: null,
      created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    {
      id: 'demo-main-6',
      url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=900&q=85',
      source: 'photographer',
      guest_name: null,
      created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
  ],
  guest: [
    {
      id: 'demo-guest-1',
      url: 'https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=900&q=85',
      source: 'guest',
      guest_name: 'Rangga',
      created_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    },
    {
      id: 'demo-guest-2',
      url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=900&q=85',
      source: 'guest',
      guest_name: 'Nadia & Tim',
      created_at: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    },
    {
      id: 'demo-guest-3',
      url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=900&q=85',
      source: 'guest',
      guest_name: 'Keluarga Besar Putra',
      created_at: new Date(Date.now() - 1000 * 60 * 11).toISOString(),
    },
    {
      id: 'demo-guest-4',
      url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=85',
      source: 'guest',
      guest_name: 'Sarah',
      created_at: new Date(Date.now() - 1000 * 60 * 16).toISOString(),
    },
  ],
};

export function formatDemoEventTitle(slug: string): string {
  const parts = slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  if (parts.length === 2) {
    return `Pernikahan ${parts[0]} & ${parts[1]}`;
  }
  return parts.join(' ');
}

export function cleanCoupleHeadline(rawName: string): string {
  return rawName
    .trim()
    .replace(/^(pernikahan|the wedding of|resepsi|engagement of)\s+/i, '');
}
