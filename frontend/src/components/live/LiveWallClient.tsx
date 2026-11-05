'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  fetchEventPhotos,
  fetchPublicEvent,
  getLocalEventCustomization,
  getLocalEventPhotos,
  subscribeLocalLiveEvents,
} from '@/lib/api';
import { createEventSocket } from '@/lib/socket';
import { PhotoItem, PublicEvent } from '@/lib/types';

interface LiveWallClientProps {
  slug: string;
}

const DEMO_WALL_PHOTOS: PhotoItem[] = [
  {
    id: 'wall-1',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=85',
    source: 'photographer',
    guest_name: null,
    created_at: new Date(Date.now() - 60000 * 2).toISOString(),
  },
  {
    id: 'wall-2',
    url: 'https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=1000&q=85',
    source: 'guest',
    guest_name: 'Rangga',
    created_at: new Date(Date.now() - 60000 * 4).toISOString(),
  },
  {
    id: 'wall-3',
    url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=1000&q=85',
    source: 'photographer',
    guest_name: null,
    created_at: new Date(Date.now() - 60000 * 5).toISOString(),
  },
  {
    id: 'wall-4',
    url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=85',
    source: 'photographer',
    guest_name: null,
    created_at: new Date(Date.now() - 60000 * 6).toISOString(),
  },
  {
    id: 'wall-5',
    url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1000&q=85',
    source: 'guest',
    guest_name: 'Nadia & Tim',
    created_at: new Date(Date.now() - 60000 * 8).toISOString(),
  },
  {
    id: 'wall-6',
    url: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=85',
    source: 'photographer',
    guest_name: null,
    created_at: new Date(Date.now() - 60000 * 11).toISOString(),
  },
];

function formatDemoEventTitle(slug: string): string {
  const parts = slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  if (parts.length === 2) {
    return `Pernikahan ${parts[0]} & ${parts[1]}`;
  }
  return parts.join(' ');
}

function cleanCoupleHeadline(rawName: string): string {
  return rawName
    .trim()
    .replace(/^(pernikahan|the wedding of|resepsi|engagement of)\s+/i, '');
}

function renderElegantTitle(headline: string, accentColor: string) {
  if (headline.includes('&')) {
    const [left, right] = headline.split('&').map((s) => s.trim());
    return (
      <>
        <span>{left}</span>
        <span
          className="italic font-normal mx-2 text-[0.92em]"
          style={{ color: accentColor }}
        >
          &amp;
        </span>
        <span>{right}</span>
      </>
    );
  }
  return headline;
}

export default function LiveWallClient({ slug }: LiveWallClientProps) {
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [originUrl, setOriginUrl] = useState('http://localhost:3000');

  // Queue of incoming photos to show as 4-second center spotlight pop-up
  const [spotlightPhoto, setSpotlightPhoto] = useState<PhotoItem | null>(null);
  const spotlightQueueRef = useRef<PhotoItem[]>([]);
  const spotlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOriginUrl(process.env.NEXT_PUBLIC_APP_URL || window.location.origin);
    }
  }, []);

  const processNextSpotlight = useCallback(() => {
    if (spotlightTimerRef.current) return;
    const nextPhoto = spotlightQueueRef.current.shift();
    if (!nextPhoto) {
      setSpotlightPhoto(null);
      return;
    }

    setSpotlightPhoto(nextPhoto);

    spotlightTimerRef.current = setTimeout(() => {
      setPhotos((prev) => {
        const filtered = prev.filter((p) => p.id !== nextPhoto.id);
        return [nextPhoto, ...filtered];
      });
      spotlightTimerRef.current = null;
      processNextSpotlight();
    }, 4000);
  }, []);

  const enqueueSpotlightPhoto = useCallback(
    (newPhoto: PhotoItem) => {
      spotlightQueueRef.current.push(newPhoto);
      processNextSpotlight();
    },
    [processNextSpotlight],
  );

  // Initial Fetch
  useEffect(() => {
    let mounted = true;

    async function loadWall() {
      const fetchedEvent = await fetchPublicEvent(slug);
      if (!mounted) return;

      if (!fetchedEvent) {
        const localCustom = getLocalEventCustomization(slug);
        setIsDemoMode(true);
        setEvent({
          id: 'demo-live-wall',
          name: localCustom?.name || formatDemoEventTitle(slug),
          header_subtitle:
            localCustom?.header_subtitle !== undefined
              ? localCustom.header_subtitle
              : 'The Wedding of',
          slug,
          status: 'active',
          theme_color: localCustom?.theme_color || '#D4AF37',
          guest_upload_limit: 5,
          is_upload_allowed: true,
        });
        const localPhotos = getLocalEventPhotos(slug);
        setPhotos([...localPhotos, ...DEMO_WALL_PHOTOS]);
        return;
      }

      const localCustom = getLocalEventCustomization(slug);
      setEvent({
        ...fetchedEvent,
        name: localCustom?.name || fetchedEvent.name,
        header_subtitle:
          localCustom?.header_subtitle !== undefined
            ? localCustom.header_subtitle
            : (fetchedEvent.header_subtitle ?? 'The Wedding of'),
      });
      const res = await fetchEventPhotos(slug, { limit: 40 });
      if (mounted) {
        const localPhotos = getLocalEventPhotos(slug);
        const map = new Map<string, PhotoItem>();
        for (const p of res.data || []) map.set(p.id, p);
        for (const p of localPhotos) {
          if (!map.has(p.id)) map.set(p.id, p);
        }
        setPhotos(Array.from(map.values()));
      }
    }

    void loadWall();

    // Background sync every 3.5s to display photos from any device on live wall
    const wallSyncTimer = setInterval(() => {
      fetchEventPhotos(slug, { limit: 40 })
        .then((res) => {
          if (!mounted || !res.data) return;
          setPhotos((prev) => {
            const knownIds = new Set(prev.map((p) => p.id));
            const newShots = res.data.filter((p) => !knownIds.has(p.id));
            if (newShots.length > 0) {
              for (const p of newShots) {
                enqueueSpotlightPhoto(p);
              }
              return [...newShots, ...prev];
            }
            return prev;
          });
        })
        .catch(() => {});
    }, 3500);

    return () => {
      mounted = false;
      clearInterval(wallSyncTimer);
    };
  }, [slug]);

  // WebSocket + Local BroadcastChannel Subscription for Real-time NEW_PHOTO
  useEffect(() => {
    const unsubLocal = subscribeLocalLiveEvents(slug, {
      onNewPhoto: (photo) => {
        enqueueSpotlightPhoto(photo);
      },
      onPhotoDeleted: (photoId) => {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      },
    });

    const socket = createEventSocket(slug);

    socket.on('NEW_PHOTO', (rawPayload: unknown) => {
      if (
        rawPayload &&
        typeof rawPayload === 'object' &&
        'slug' in rawPayload &&
        typeof (rawPayload as { slug?: unknown }).slug === 'string' &&
        (rawPayload as { slug: string }).slug !== slug
      ) {
        return;
      }
      const payload =
        rawPayload &&
        typeof rawPayload === 'object' &&
        'data' in rawPayload &&
        (rawPayload as { data?: PhotoItem }).data
          ? (rawPayload as { data: PhotoItem }).data
          : (rawPayload as PhotoItem);

      if (!payload || !payload.id || !payload.url) return;
      enqueueSpotlightPhoto(payload);
    });

    socket.on('PHOTO_DELETED', (rawPayload: unknown) => {
      const data =
        rawPayload && typeof rawPayload === 'object' && 'data' in rawPayload
          ? (rawPayload as { data: { id: string } }).data
          : (rawPayload as { id: string });

      if (!data?.id) return;
      setPhotos((prev) => prev.filter((p) => p.id !== data.id));
    });

    return () => {
      unsubLocal();
      socket.disconnect();
    };
  }, [slug, enqueueSpotlightPhoto]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const simulateIncomingPhoto = (source: 'photographer' | 'guest') => {
    const sampleUrl =
      source === 'photographer'
        ? 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=85'
        : 'https://images.unsplash.com/photo-1529636798458-92182e662485?auto=format&fit=crop&w=1200&q=85';

    enqueueSpotlightPhoto({
      id: `sim-${Date.now()}`,
      url: sampleUrl,
      source,
      guest_name: source === 'guest' ? 'Rangga' : null,
      created_at: new Date().toISOString(),
    });
  };

  const themeColor = event?.theme_color || '#D4AF37';
  const qrUrl = `${originUrl.replace(/\/+$/, '')}/${slug}`;
  const isPanPaused = Boolean(spotlightPhoto);
  const headline = cleanCoupleHeadline(
    event?.name || formatDemoEventTitle(slug),
  );
  const headerSubtitle =
    event?.header_subtitle !== undefined
      ? event.header_subtitle
      : 'The Wedding of';

  const displayedGridPhotos =
    photos.length >= 4 ? [...photos, ...photos] : photos;

  return (
    <div className="h-screen w-screen overflow-hidden bg-neutral-950 text-white flex select-none relative">
      {/* SISI KIRI (1/4 Layar): Judul Acara / Nama Pengantin Menonjol, Theme Color Dinamis, QR Code Besar */}
      <aside
        className="w-1/4 min-w-[310px] max-w-[420px] h-full flex flex-col justify-between p-8 border-r border-white/15 z-20 relative overflow-hidden"
        style={{
          background: `linear-gradient(165deg, ${themeColor}33 0%, #12100E 55%, #09090B 100%)`,
          borderLeft: `6px solid ${themeColor}`,
        }}
      >
        <div
          className="absolute -top-24 -left-24 w-64 h-64 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: themeColor }}
        />

        {/* Top: Prominent Bride & Groom / Event Title (Elegant Serif, No Pill Button) */}
        <div className="relative space-y-2.5 text-center pt-3">
          {headerSubtitle && (
            <p className="font-display italic text-lg xl:text-xl tracking-[0.12em] text-white/85 drop-shadow">
              {headerSubtitle}
            </p>
          )}

          <h1 className="font-display text-4xl xl:text-5xl font-medium tracking-[0.04em] leading-tight text-white drop-shadow-lg">
            {renderElegantTitle(headline, themeColor)}
          </h1>

          <div className="flex items-center justify-center gap-3">
            <span
              className="h-[1px] w-12 opacity-60"
              style={{ backgroundColor: themeColor }}
            />
            <span
              className="w-1.5 h-1.5 rotate-45 opacity-80"
              style={{ backgroundColor: themeColor }}
            />
            <span
              className="h-[1px] w-12 opacity-60"
              style={{ backgroundColor: themeColor }}
            />
          </div>
        </div>

        {/* Center: Large QR Code & Call to Action */}
        <div className="relative my-auto flex flex-col items-center text-center space-y-5">
          <div
            className="p-5 rounded-3xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.7)] border-4"
            style={{ borderColor: themeColor }}
          >
            <QRCodeSVG
              value={qrUrl}
              size={215}
              bgColor="#FFFFFF"
              fgColor="#0A0A0A"
              level="H"
              includeMargin={false}
            />
          </div>

          <div className="space-y-1.5 px-2">
            <p className="text-lg xl:text-xl font-extrabold text-white leading-snug">
              Scan QR untuk simpan &amp; bagikan foto!
            </p>
            <p className="text-xs font-mono text-neutral-400 break-all">
              {qrUrl}
            </p>
          </div>
        </div>

        {/* Bottom: Subtle Operator Controls */}
        <div className="relative space-y-2.5 pt-4 border-t border-white/10">
          {isDemoMode && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => simulateIncomingPhoto('photographer')}
                className="px-2.5 py-2 rounded-xl text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10"
              >
                + Simulasi Kamera
              </button>
              <button
                type="button"
                onClick={() => simulateIncomingPhoto('guest')}
                className="px-2.5 py-2 rounded-xl text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10"
              >
                + Simulasi Tamu
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>{photos.length} foto ditayangkan</span>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300"
              title="Layar Penuh (F11)"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>F11 Layar Penuh</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* SISI KANAN (3/4 Layar): Area Grid Foto Dinamis (Auto-Scroll Pan) */}
      <main className="w-3/4 flex-1 h-full overflow-hidden relative p-6 bg-neutral-950">
        {photos.length === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-center">
            <Sparkles
              className="w-14 h-14 mb-4 animate-pulse"
              style={{ color: themeColor }}
            />
            <h2 className="font-display text-3xl font-bold text-white">
              {headline}
            </h2>
            <p className="text-sm text-neutral-400 mt-2">
              Foto dari kamera utama &amp; tamu akan tampil otomatis di layar ini.
            </p>
          </div>
        ) : (
          <div
            className={`columns-2 lg:columns-3 gap-5 space-y-5 ${
              photos.length >= 4 ? 'animate-slow-pan' : ''
            } ${isPanPaused ? 'animate-slow-pan-paused' : ''}`}
          >
            {displayedGridPhotos.map((photo, idx) => (
              <div
                key={`${photo.id}-${idx}`}
                className="break-inside-avoid relative rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shadow-xl"
              >
                <img
                  src={photo.url}
                  alt="Live Wall Photo"
                  className="w-full h-auto object-cover block"
                />

                {/* Badge Nama di Grid: Hanya untuk Tamu (Fotografer bersih) */}
                {photo.source === 'guest' && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3.5 pt-8">
                    <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold bg-black/75 text-white border border-white/15">
                      📸 Momen dari: {photo.guest_name || 'Tamu'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* POP-UP ANIMATION KE TENGAH LAYAR SAAT NEW_PHOTO (3-5 Detik) */}
        {spotlightPhoto && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-10">
            <div className="relative max-w-4xl w-full flex flex-col items-center">
              <div
                className="relative rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.9)] border-4 bg-neutral-950"
                style={{ borderColor: themeColor }}
              >
                <img
                  src={spotlightPhoto.url}
                  alt="Foto Baru"
                  className="max-h-[76vh] w-auto object-contain block"
                />
              </div>

              {/* Atribusi Nama sesuai /ui-ux-flow:
                  - Jika foto dari Fotografer: Bersih tanpa teks tambahan (menonjolkan custom frame).
                  - Jika foto dari Tamu: Muncul pita elegan di bawah foto bertuliskan: "📸 Momen dari: [Nama Tamu]" */}
              {spotlightPhoto.source === 'guest' && (
                <div
                  className="mt-5 px-8 py-3.5 rounded-full shadow-2xl text-neutral-950 font-extrabold text-lg xl:text-xl tracking-wide flex items-center gap-2.5"
                  style={{ backgroundColor: themeColor }}
                >
                  <span>
                    📸 Momen dari: {spotlightPhoto.guest_name || 'Tamu'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
