'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  QrCode,
  Sparkles,
} from 'lucide-react';
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
  const [isCardCollapsed, setIsCardCollapsed] = useState(false);
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
        custom_frame_url:
          localCustom?.custom_frame_url !== undefined
            ? localCustom.custom_frame_url
            : fetchedEvent.custom_frame_url,
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

      fetchPublicEvent(slug)
        .then((evt) => {
          if (!mounted || !evt) return;
          const localCustom = getLocalEventCustomization(slug);
          setEvent((prev) => {
            if (!prev) return evt;
            return {
              ...prev,
              ...evt,
              name: localCustom?.name || evt.name,
              header_subtitle:
                localCustom?.header_subtitle !== undefined
                  ? localCustom.header_subtitle
                  : (evt.header_subtitle ?? 'The Wedding of'),
              custom_frame_url:
                localCustom?.custom_frame_url !== undefined
                  ? localCustom.custom_frame_url
                  : evt.custom_frame_url,
            };
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
      onEventUpdated: (eventData) => {
        setEvent((prev) => (prev ? { ...prev, ...eventData } : null));
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
    <div className="h-screen w-screen overflow-hidden bg-neutral-950 text-white select-none relative">
      {/* 100% FULLSCREEN PHOTO STREAM (EDGE-TO-EDGE) */}
      <main className="w-full h-full overflow-hidden relative p-4 sm:p-6 lg:p-8 bg-neutral-950">
        {photos.length === 0 ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-center">
            <Sparkles
              className="w-14 h-14 mb-4 animate-pulse"
              style={{ color: themeColor }}
            />
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-white">
              {headline}
            </h2>
            <p className="text-base text-neutral-400 mt-2">
              Foto dari kamera utama &amp; tamu akan tampil otomatis di layar ini.
            </p>
          </div>
        ) : (
          <div
            className={`columns-2 sm:columns-3 md:columns-4 lg:columns-4 xl:columns-5 2xl:columns-6 gap-5 space-y-5 ${
              photos.length >= 4 ? 'animate-slow-pan' : ''
            } ${isPanPaused ? 'animate-slow-pan-paused' : ''}`}
          >
            {displayedGridPhotos.map((photo, idx) => (
              <div
                key={`${photo.id}-${idx}`}
                className={`break-inside-avoid relative rounded-2xl overflow-hidden shadow-2xl transition-transform hover:scale-[1.01] ${
                  event?.custom_frame_url
                    ? 'aspect-[5/7] bg-white border border-white/20'
                    : 'bg-neutral-900 border border-white/10'
                }`}
              >
                {event?.custom_frame_url ? (
                  <>
                    <div className="absolute left-[4.8%] right-[4.8%] top-[3.43%] h-[74.28%] overflow-hidden bg-neutral-900 rounded-[2px]">
                      <img
                        src={photo.url}
                        alt="Live Wall Photo"
                        className="w-full h-full object-cover block"
                      />
                    </div>
                    <img
                      src={event.custom_frame_url}
                      alt="Bingkai Digital"
                      className="absolute inset-0 w-full h-full object-fill pointer-events-none z-10"
                    />
                  </>
                ) : (
                  <img
                    src={photo.url}
                    alt="Live Wall Photo"
                    className="w-full h-auto object-cover block"
                  />
                )}

                {/* Badge Nama di Grid: Hanya untuk Tamu (Fotografer bersih) */}
                {photo.source === 'guest' && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3.5 pt-8 z-20">
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
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-6 sm:p-10">
            <div className="relative max-w-4xl w-full flex flex-col items-center">
              {event?.custom_frame_url ? (
                <div className="relative aspect-[5/7] max-h-[76vh] h-[76vh] w-auto rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.9)] bg-white border-2 border-white/20">
                  <div className="absolute left-[4.8%] right-[4.8%] top-[3.43%] h-[74.28%] overflow-hidden bg-neutral-900 rounded-[2px]">
                    <img
                      src={spotlightPhoto.url}
                      alt="Foto Baru"
                      className="w-full h-full object-cover block"
                    />
                  </div>
                  <img
                    src={event.custom_frame_url}
                    alt="Bingkai Digital"
                    className="absolute inset-0 w-full h-full object-fill pointer-events-none z-10"
                  />
                </div>
              ) : (
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
              )}

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

      {/* FLOATING CORNER GLASS CARD (OPSI 1) */}
      <aside
        className={`fixed bottom-6 left-6 z-30 transition-all duration-300 ${
          isCardCollapsed
            ? 'bg-[#0B0B0A]/85 backdrop-blur-2xl border border-white/20 rounded-2xl px-4 py-3 shadow-[0_15px_40px_rgba(0,0,0,0.85)] flex items-center gap-3 cursor-pointer hover:bg-black/95'
            : 'w-[280px] sm:w-[310px] bg-[#0B0B0A]/85 backdrop-blur-2xl border border-white/15 rounded-3xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.9)] space-y-4'
        }`}
        style={{
          borderLeft: `5px solid ${themeColor}`,
        }}
      >
        {isCardCollapsed ? (
          <button
            type="button"
            onClick={() => setIsCardCollapsed(false)}
            className="flex items-center gap-3 text-xs font-semibold text-white tracking-wide"
          >
            <div
              className="p-1.5 rounded-lg text-neutral-950"
              style={{ backgroundColor: themeColor }}
            >
              <QrCode className="w-4 h-4" />
            </div>
            <span>Scan QR Acara</span>
            <ChevronUp className="w-4 h-4 text-neutral-400 ml-1" />
          </button>
        ) : (
          <>
            {/* Header: Event Subtitle, Headline, and Collapse button */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                {headerSubtitle && (
                  <p className="font-display italic text-xs tracking-[0.14em] text-white/75">
                    {headerSubtitle}
                  </p>
                )}
                <h1 className="font-display text-2xl font-semibold tracking-[0.03em] leading-tight text-white drop-shadow">
                  {renderElegantTitle(headline, themeColor)}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setIsCardCollapsed(true)}
                title="Kecilkan Kartu"
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center text-center space-y-3 pt-1">
              <div
                className="p-3.5 rounded-2xl bg-white shadow-xl border-2"
                style={{ borderColor: themeColor }}
              >
                <QRCodeSVG
                  value={qrUrl}
                  size={145}
                  bgColor="#FFFFFF"
                  fgColor="#0A0A0A"
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="space-y-1 px-1">
                <p className="text-xs font-bold text-white tracking-wide">
                  Scan QR untuk simpan &amp; bagikan foto
                </p>
                <p className="text-[10px] font-mono text-neutral-400 break-all opacity-80">
                  {qrUrl.replace(/^https?:\/\//, '')}
                </p>
              </div>
            </div>

            {/* Bottom Status & Layar Penuh Control */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400">
              <span>{photos.length} foto ditayangkan</span>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-neutral-300 transition-colors"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3 h-3" />
                    <span>Keluar</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3 h-3" />
                    <span>F11</span>
                  </>
                )}
              </button>
            </div>

            {/* Demo simulation if active */}
            {isDemoMode && (
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => simulateIncomingPhoto('photographer')}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10"
                >
                  + Kamera
                </button>
                <button
                  type="button"
                  onClick={() => simulateIncomingPhoto('guest')}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10"
                >
                  + Tamu
                </button>
              </div>
            )}
          </>
        )}
      </aside>

      {/* FLOATING FULLSCREEN BUTTON (BOTTOM-RIGHT, ALWAYS ACCESSIBLE) */}
      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Keluar Layar Penuh (F11)' : 'Layar Penuh (F11)'}
        className="fixed bottom-6 right-6 z-30 p-3 rounded-full bg-[#0B0B0A]/80 hover:bg-[#0B0B0A] backdrop-blur-xl border border-white/15 text-neutral-300 hover:text-white shadow-2xl transition-all"
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4" />
        ) : (
          <Maximize2 className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
