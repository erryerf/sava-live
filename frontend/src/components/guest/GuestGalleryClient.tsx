'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  addLocalEventPhoto,
  confirmGuestPhotoUpload,
  fetchEventArchiveStatus,
  fetchEventPhotos,
  fetchPublicEvent,
  getLocalEventCustomization,
  getLocalEventPhotos,
  getLocalGuestUploadCount,
  getOrCreateGuestIdentifier,
  incrementLocalGuestUploadCount,
  requestGuestPresignedUrl,
  subscribeLocalLiveEvents,
  uploadFileToPresignedUrl,
} from '@/lib/api';
import { createEventSocket } from '@/lib/socket';
import {
  ArchiveStatus,
  PhotoItem,
  PhotoSource,
  PublicEvent,
} from '@/lib/types';

interface GuestGalleryClientProps {
  slug: string;
}

const DEMO_PHOTOS: Record<PhotoSource, PhotoItem[]> = {
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

const DEFAULT_DEMO_HEADER_PHOTO =
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=80';

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
          className="italic font-normal mx-2.5 text-[0.92em]"
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

export default function GuestGalleryClient({ slug }: GuestGalleryClientProps) {
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PhotoSource>('photographer');

  const [photosByTab, setPhotosByTab] = useState<
    Record<PhotoSource, PhotoItem[]>
  >({
    photographer: [],
    guest: [],
  });
  const [cursorByTab, setCursorByTab] = useState<
    Record<PhotoSource, string | null>
  >({
    photographer: null,
    guest: null,
  });
  const [hasMoreByTab, setHasMoreByTab] = useState<
    Record<PhotoSource, boolean>
  >({
    photographer: false,
    guest: false,
  });
  const [loadingMore, setLoadingMore] = useState(false);

  const [toast, setToast] = useState<{
    text: string;
    type: 'success' | 'info' | 'warning';
  } | null>(null);

  // Lightbox Modal State
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  // Guest Upload & Continuous Live Camera State
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<
    'environment' | 'user'
  >('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [capturedQueue, setCapturedQueue] = useState<
    { id: string; file: File; previewUrl: string }[]
  >([]);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [usedQuota, setUsedQuota] = useState(0);

  // Post-Event Archive State
  const [archiveInfo, setArchiveInfo] = useState<{
    status: ArchiveStatus;
    download_url: string | null;
  }>({ status: 'none', download_url: null });

  const showToast = useCallback(
    (text: string, type: 'success' | 'info' | 'warning' = 'info') => {
      setToast({ text, type });
      setTimeout(() => {
        setToast((prev) => (prev?.text === text ? null : prev));
      }, 3600);
    },
    [],
  );

  // Initial Load: Event + Both Tabs
  useEffect(() => {
    let mounted = true;
    setUsedQuota(getLocalGuestUploadCount(slug));

    async function loadInitial() {
      setLoading(true);
      const fetchedEvent = await fetchPublicEvent(slug);

      if (!mounted) return;

      if (!fetchedEvent) {
        const localCustom = getLocalEventCustomization(slug);
        setIsDemoMode(true);
        setEvent({
          id: 'demo-event-id',
          name: localCustom?.name || formatDemoEventTitle(slug),
          header_subtitle:
            localCustom?.header_subtitle !== undefined
              ? localCustom.header_subtitle
              : 'The Wedding of',
          slug,
          status: 'active',
          theme_color: localCustom?.theme_color || '#D4AF37',
          header_image_url:
            localCustom?.header_image_url !== undefined
              ? localCustom.header_image_url
              : DEFAULT_DEMO_HEADER_PHOTO,
          guest_upload_limit: 5,
          is_upload_allowed: true,
        });
        const localPhotos = getLocalEventPhotos(slug);
        setPhotosByTab({
          photographer: [
            ...localPhotos.filter((p) => p.source === 'photographer'),
            ...DEMO_PHOTOS.photographer,
          ],
          guest: [
            ...localPhotos.filter((p) => p.source === 'guest'),
            ...DEMO_PHOTOS.guest,
          ],
        });
        setLoading(false);
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
        header_image_url:
          fetchedEvent.header_image_url ||
          localCustom?.header_image_url ||
          null,
      });

      const [mainRes, guestRes] = await Promise.all([
        fetchEventPhotos(slug, { limit: 30, source: 'photographer' }),
        fetchEventPhotos(slug, { limit: 30, source: 'guest' }),
      ]);

      if (!mounted) return;

      const localPhotos = getLocalEventPhotos(slug);
      setPhotosByTab({
        photographer: [
          ...localPhotos.filter((p) => p.source === 'photographer'),
          ...(mainRes.data || []),
        ],
        guest: [
          ...localPhotos.filter((p) => p.source === 'guest'),
          ...(guestRes.data || []),
        ],
      });
      setCursorByTab({
        photographer: mainRes.meta?.next_cursor ?? null,
        guest: guestRes.meta?.next_cursor ?? null,
      });
      setHasMoreByTab({
        photographer: Boolean(mainRes.meta?.has_more),
        guest: Boolean(guestRes.meta?.has_more),
      });

      if (fetchedEvent.status === 'archived') {
        const arch = await fetchEventArchiveStatus(slug);
        if (mounted && arch) {
          setArchiveInfo(arch);
        }
      }

      setLoading(false);
    }

    void loadInitial();
    return () => {
      mounted = false;
    };
  }, [slug]);

  // Real-time Socket.io + Local BroadcastChannel Subscription (with 350ms Burst Batching)
  useEffect(() => {
    const incomingBuffer: PhotoItem[] = [];
    let batchTimer: ReturnType<typeof setTimeout> | null = null;

    const enqueueIncomingPhoto = (photo: PhotoItem) => {
      incomingBuffer.push(photo);
      if (batchTimer) return;

      batchTimer = setTimeout(() => {
        const batch = incomingBuffer.splice(0, incomingBuffer.length);
        batchTimer = null;
        if (batch.length === 0) return;

        setPhotosByTab((prev) => {
          const nextPhotographer = [...prev.photographer];
          const nextGuest = [...prev.guest];

          for (const item of batch) {
            const targetList =
              item.source === 'guest' ? nextGuest : nextPhotographer;
            if (!targetList.some((p) => p.id === item.id)) {
              targetList.unshift(item);
            }
          }

          return {
            photographer: nextPhotographer,
            guest: nextGuest,
          };
        });

        showToast(
          batch.length > 1
            ? `${batch.length} foto baru masuk! ✨`
            : 'Foto baru masuk! ✨',
          'info',
        );
      }, 350);
    };

    const unsubLocal = subscribeLocalLiveEvents(slug, {
      onNewPhoto: (photo) => {
        enqueueIncomingPhoto(photo);
      },
      onPhotoDeleted: (photoId) => {
        setPhotosByTab((prev) => ({
          photographer: prev.photographer.filter((p) => p.id !== photoId),
          guest: prev.guest.filter((p) => p.id !== photoId),
        }));
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
      enqueueIncomingPhoto(payload);
    });

    socket.on('PHOTO_DELETED', (rawPayload: unknown) => {
      const data =
        rawPayload && typeof rawPayload === 'object' && 'data' in rawPayload
          ? (rawPayload as { data: { id: string } }).data
          : (rawPayload as { id: string });

      if (!data?.id) return;
      setPhotosByTab((prev) => ({
        photographer: prev.photographer.filter((p) => p.id !== data.id),
        guest: prev.guest.filter((p) => p.id !== data.id),
      }));
    });

    socket.on('EVENT_STATUS_CHANGED', async (rawPayload: unknown) => {
      const data =
        rawPayload && typeof rawPayload === 'object' && 'data' in rawPayload
          ? (rawPayload as { data: { status: PublicEvent['status'] } }).data
          : (rawPayload as { status: PublicEvent['status'] });

      if (!data?.status) return;
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              status: data.status,
              is_upload_allowed: data.status === 'active',
            }
          : prev,
      );

      if (data.status === 'archived') {
        const arch = await fetchEventArchiveStatus(slug);
        if (arch) setArchiveInfo(arch);
      }
    });

    return () => {
      if (batchTimer) clearTimeout(batchTimer);
      unsubLocal();
      socket.disconnect();
    };
  }, [slug, showToast]);

  // Poll archive status while processing in archived mode
  useEffect(() => {
    if (event?.status !== 'archived' || isDemoMode) return;
    if (archiveInfo.status === 'ready') return;

    const timer = setInterval(async () => {
      const arch = await fetchEventArchiveStatus(slug);
      if (arch) setArchiveInfo(arch);
    }, 5000);

    return () => clearInterval(timer);
  }, [event?.status, archiveInfo.status, slug, isDemoMode]);

  const currentPhotos = photosByTab[activeTab];
  const themeColor = event?.theme_color || '#D4AF37';
  const uploadLimit = event?.guest_upload_limit ?? 5;
  const remainingQuota = Math.max(0, uploadLimit - usedQuota);
  const isArchived =
    event?.status === 'archived' || event?.is_upload_allowed === false;

  const headline = cleanCoupleHeadline(
    event?.name || formatDemoEventTitle(slug),
  );
  const headerSubtitle =
    event?.header_subtitle !== undefined
      ? event.header_subtitle
      : 'The Wedding of';

  // Load more (cursor pagination)
  const handleLoadMore = async () => {
    if (loadingMore || !hasMoreByTab[activeTab] || !cursorByTab[activeTab]) {
      return;
    }
    setLoadingMore(true);
    try {
      const res = await fetchEventPhotos(slug, {
        limit: 30,
        cursor: cursorByTab[activeTab],
        source: activeTab,
      });
      setPhotosByTab((prev) => ({
        ...prev,
        [activeTab]: [...prev[activeTab], ...(res.data || [])],
      }));
      setCursorByTab((prev) => ({
        ...prev,
        [activeTab]: res.meta?.next_cursor ?? null,
      }));
      setHasMoreByTab((prev) => ({
        ...prev,
        [activeTab]: Boolean(res.meta?.has_more),
      }));
    } finally {
      setLoadingMore(false);
    }
  };

  // Lightbox Navigation & Direct Download
  const handlePrevPhoto = useCallback(() => {
    setLightboxIndex((prev) => {
      if (prev === null || currentPhotos.length === 0) return null;
      return (prev - 1 + currentPhotos.length) % currentPhotos.length;
    });
  }, [currentPhotos.length]);

  const handleNextPhoto = useCallback(() => {
    setLightboxIndex((prev) => {
      if (prev === null || currentPhotos.length === 0) return null;
      return (prev + 1) % currentPhotos.length;
    });
  }, [currentPhotos.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevPhoto();
      if (e.key === 'ArrowRight') handleNextPhoto();
      if (e.key === 'Escape') setLightboxIndex(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, handlePrevPhoto, handleNextPhoto]);

  const handleDirectDownload = async (photo: PhotoItem) => {
    try {
      const response = await fetch(photo.url, { mode: 'cors' });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${slug}-${photo.id.slice(0, 8)}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast('Foto disimpan ke HP! 📸', 'success');
    } catch {
      window.open(photo.url, '_blank', 'noopener,noreferrer');
    }
  };

  const stopLiveCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopLiveCamera();
    };
  }, [stopLiveCamera]);

  const startLiveCamera = useCallback(
    async (facing: 'environment' | 'user' = cameraFacingMode) => {
      if (!guestNameInput.trim()) {
        showToast('Isi nama Anda dulu sebelum membuka kamera 😊', 'warning');
        return;
      }

      stopLiveCamera();
      setCameraError(null);
      setIsCameraActive(true);

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCameraError(
          'Browser ini tidak mendukung akses kamera langsung. Gunakan tombol ambil foto di bawah.',
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            await videoRef.current.play().catch(() => {});
          }
        } catch {
          setCameraError(
            'Izin kamera ditolak atau kamera sedang dipakai aplikasi lain. Klik ikon gembok/kamera di sebelah alamat URL browser (localhost:3000) lalu pilih "Allow / Izinkan" Kamera.',
          );
        }
      }
    },
    [cameraFacingMode, guestNameInput, showToast, stopLiveCamera],
  );

  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      void node.play().catch(() => {});
    }
  }, []);

  const handleFlipCamera = () => {
    const nextFacing =
      cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextFacing);
    void startLiveCamera(nextFacing);
  };

  const handleCapturePhotoFromStream = () => {
    if (capturedQueue.length >= remainingQuota) {
      showToast(
        `Kuota foto penuh (${uploadLimit}/${uploadLimit}). Klik Kirim untuk membagikan! ✨`,
        'warning',
      );
      return;
    }

    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    // Trigger subtle shutter flash without stopping camera stream
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 140);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (cameraFacingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const shotId = `shot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const capturedFile = new File([blob], `${shotId}.jpg`, {
          type: 'image/jpeg',
        });
        const url = URL.createObjectURL(capturedFile);

        setCapturedQueue((prev) => {
          if (prev.length >= remainingQuota) {
            URL.revokeObjectURL(url);
            return prev;
          }
          const next = [
            ...prev,
            { id: shotId, file: capturedFile, previewUrl: url },
          ];
          if (next.length >= remainingQuota) {
            showToast(
              `Batas kuota (${uploadLimit}/${uploadLimit}) tercapai! Klik Kirim di bawah 🚀`,
              'info',
            );
          }
          return next;
        });
      },
      'image/jpeg',
      0.92,
    );
  };

  const handleRemoveCapturedShot = (shotId: string) => {
    setCapturedQueue((prev) => {
      const target = prev.find((item) => item.id === shotId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== shotId);
    });
  };

  // FAB Tap -> Quota Check -> Open Name Input Modal First before Camera
  const handleFabClick = () => {
    if (usedQuota >= uploadLimit) {
      showToast(
        `Batas upload (${uploadLimit}/${uploadLimit}) penuh. Nikmati acaranya! 🎉`,
        'warning',
      );
      return;
    }
    setCapturedQueue((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setIsCameraActive(false);
    setCameraError(null);
    setIsUploadModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setCapturedQueue((prev) => {
      const availableSlots = Math.max(0, remainingQuota - prev.length);
      const allowedFiles = files.slice(0, availableSlots);
      const newItems = allowedFiles.map((file) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...newItems];
    });
    setIsCameraActive(true);
    setIsUploadModalOpen(true);
    e.target.value = '';
  };

  const closeUploadModal = () => {
    stopLiveCamera();
    setCapturedQueue((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setCameraError(null);
    setIsUploadModalOpen(false);
  };

  const handleConfirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (capturedQueue.length === 0 || uploading) return;
    if (!guestNameInput.trim()) {
      showToast('Isi nama Anda dulu ya! 😊', 'warning');
      return;
    }

    setUploading(true);
    try {
      const guestIdentifier = getOrCreateGuestIdentifier();
      const totalSent = capturedQueue.length;

      if (isDemoMode) {
        const newDemoPhotos: PhotoItem[] = [];
        let latestQuota = usedQuota;

        for (const item of capturedQueue) {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve(
                typeof reader.result === 'string'
                  ? reader.result
                  : item.previewUrl,
              );
            reader.onerror = () => resolve(item.previewUrl);
            reader.readAsDataURL(item.file);
          });

          const demoPhoto: PhotoItem = {
            id: `guest-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            url: dataUrl,
            source: 'guest',
            guest_name: guestNameInput.trim() || 'Tamu',
            created_at: new Date().toISOString(),
          };
          addLocalEventPhoto(slug, demoPhoto);
          newDemoPhotos.unshift(demoPhoto);
          latestQuota = incrementLocalGuestUploadCount(slug);
        }

        setPhotosByTab((prev) => ({
          ...prev,
          guest: [...newDemoPhotos, ...prev.guest],
        }));
        setUsedQuota(latestQuota);
        closeUploadModal();
        setActiveTab('guest');
        showToast(
          `${totalSent} foto terkirim! Terima kasih sudah berbagi momen ✨`,
          'success',
        );
        return;
      }

      let latestQuota = usedQuota;
      for (const item of capturedQueue) {
        const presigned = await requestGuestPresignedUrl(slug, {
          filename: item.file.name,
          content_type: item.file.type || 'image/jpeg',
          guest_identifier: guestIdentifier,
        });

        await uploadFileToPresignedUrl(presigned.upload_url, item.file);

        await confirmGuestPhotoUpload(slug, {
          file_key: presigned.file_key,
          guest_identifier: guestIdentifier,
          guest_name: guestNameInput.trim() || undefined,
        });

        latestQuota = incrementLocalGuestUploadCount(slug);
      }

      setUsedQuota(latestQuota);
      closeUploadModal();
      setActiveTab('guest');
      showToast(
        `${totalSent} foto terkirim! Terima kasih sudah berbagi momen ✨`,
        'success',
      );
    } catch (err) {
      showToast(
        (err as Error).message || 'Gagal kirim foto. Coba lagi!',
        'warning',
      );
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        <p className="text-sm text-neutral-400 font-medium">Memuat galeri...</p>
      </div>
    );
  }

  const activeLightboxPhoto =
    lightboxIndex !== null ? currentPhotos[lightboxIndex] : null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-28">
      {/* Toast Notification (Anti "AI Slop" short punchy copy) */}
      {toast && (
        <div className="fixed top-6 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div
            className={`px-5 py-3 rounded-full shadow-2xl text-xs sm:text-sm font-bold backdrop-blur-xl border transition-all duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-200 border-emerald-400/40'
                : toast.type === 'warning'
                  ? 'bg-amber-950/95 text-amber-200 border-amber-400/40'
                  : 'bg-neutral-900/95 text-white border-white/20'
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}

      {/* 1. STICKY HEADER & TAB SYSTEM (Custom Header Photo Darkened + Prominent Couple/Event Name) */}
      <header className="sticky top-0 z-30 shadow-2xl">
        <div
          className="relative overflow-hidden border-b border-white/15"
          style={{
            background: `linear-gradient(145deg, ${themeColor} 0%, #1A1610 60%, #09090B 100%)`,
          }}
        >
          {/* Custom Header Background Photo (Darkened so couple's name stands out clearly) */}
          {event?.header_image_url && (
            <>
              <img
                src={event.header_image_url}
                alt={event.name}
                className="absolute inset-0 w-full h-full object-cover object-center brightness-[0.38] contrast-105 scale-105 pointer-events-none select-none"
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.52) 55%, rgba(9,9,11,0.92) 100%)`,
                }}
              />
              <div
                className="absolute inset-0 opacity-25 mix-blend-overlay pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 0%, ${themeColor}, transparent 70%)`,
                }}
              />
            </>
          )}

          {/* Bottom Accent Line in theme_color */}
          <div
            className="absolute inset-x-0 top-0 h-1 z-10"
            style={{ backgroundColor: themeColor }}
          />

          <div className="relative z-10 max-w-2xl mx-auto px-4 pt-7 pb-6 text-center">
            {headerSubtitle && (
              <p className="font-display italic text-base sm:text-lg tracking-[0.12em] text-white/85 drop-shadow mb-1">
                {headerSubtitle}
              </p>
            )}

            <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-[0.04em] text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] leading-none">
              {renderElegantTitle(headline, themeColor)}
            </h1>

            {/* Delicate Ornamental Line */}
            <div className="flex items-center justify-center gap-3 my-3">
              <span
                className="h-[1px] w-10 opacity-60"
                style={{ backgroundColor: themeColor }}
              />
              <span
                className="w-1.5 h-1.5 rotate-45 opacity-80"
                style={{ backgroundColor: themeColor }}
              />
              <span
                className="h-[1px] w-10 opacity-60"
                style={{ backgroundColor: themeColor }}
              />
            </div>

            <p className="font-display italic text-sm sm:text-base tracking-wide text-neutral-200/90 drop-shadow">
              {isArchived
                ? 'Kenangan resmi acara • Ketuk foto untuk menyimpan'
                : 'Abadikan & simpan setiap momen indah hari ini'}
            </p>
          </div>
        </div>

        {/* 2. Navigasi Tab (Kamera Utama vs Kamera Tamu) */}
        <div className="bg-neutral-950/90 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-2xl mx-auto px-3.5 py-2.5">
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-neutral-900/95 border border-white/10 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab('photographer')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                  activeTab === 'photographer'
                    ? 'text-neutral-950 shadow-lg scale-[1.01]'
                    : 'text-neutral-400 hover:text-white'
                }`}
                style={
                  activeTab === 'photographer'
                    ? { backgroundColor: themeColor }
                    : undefined
                }
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>Kamera Utama</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${
                    activeTab === 'photographer'
                      ? 'bg-black/20 text-neutral-950 font-extrabold'
                      : 'bg-white/10 text-neutral-300'
                  }`}
                >
                  {photosByTab.photographer.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('guest')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                  activeTab === 'guest'
                    ? 'text-neutral-950 shadow-lg scale-[1.01]'
                    : 'text-neutral-400 hover:text-white'
                }`}
                style={
                  activeTab === 'guest'
                    ? { backgroundColor: themeColor }
                    : undefined
                }
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Kamera Tamu</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${
                    activeTab === 'guest'
                      ? 'bg-black/20 text-neutral-950 font-extrabold'
                      : 'bg-white/10 text-neutral-300'
                  }`}
                >
                  {photosByTab.guest.length}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* B. Alur Pasca-Acara: Banner Download Arsip (.ZIP) */}
      {isArchived && (
        <div className="max-w-2xl mx-auto px-3.5 pt-4">
          <div className="p-4 rounded-2xl bg-neutral-900/95 border border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-neutral-950 shadow-md"
                style={{ backgroundColor: themeColor }}
              >
                <FileArchive className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  Unduh Arsip (.ZIP)
                </p>
                <p className="text-xs text-neutral-400">
                  Terpisah rapi folder Utama &amp; Tamu
                </p>
              </div>
            </div>

            {archiveInfo.status === 'ready' && archiveInfo.download_url ? (
              <a
                href={archiveInfo.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto text-center px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold text-neutral-950 shadow-lg transition hover:opacity-90"
                style={{ backgroundColor: themeColor }}
              >
                Unduh Arsip Lengkap
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-neutral-800 text-neutral-400 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Merapikan arsip...
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Feed Foto (Masonry Grid) */}
      <main className="max-w-2xl mx-auto px-3 sm:px-4 pt-4">
        {currentPhotos.length === 0 ? (
          <div className="py-20 px-4 text-center rounded-3xl border border-dashed border-white/15 bg-neutral-900/40">
            <Sparkles
              className="w-9 h-9 mx-auto mb-2.5"
              style={{ color: themeColor }}
            />
            <p className="text-sm font-bold text-white">
              {activeTab === 'photographer'
                ? 'Menunggu bidikan pertama fotografer 📸'
                : 'Belum ada kiriman foto tamu'}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {activeTab === 'photographer'
                ? 'Foto terbaru otomatis muncul di sini.'
                : 'Ketuk tombol di kanan bawah untuk berbagi momen!'}
            </p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 gap-3 space-y-3">
            {currentPhotos.map((photo, index) => (
              <div
                key={photo.id}
                onClick={() => setLightboxIndex(index)}
                className="break-inside-avoid relative group rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shadow-lg cursor-pointer active:scale-[0.98] transition-all"
              >
                <img
                  src={photo.thumbnail_url || photo.url}
                  alt={
                    photo.guest_name
                      ? `Momen dari ${photo.guest_name}`
                      : 'Foto Acara'
                  }
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto object-cover block group-hover:scale-105 transition-transform duration-500"
                />

                {/* Label nama kecil di sudut bawah thumbnail khusus Tab "Kamera Tamu" */}
                {photo.source === 'guest' && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-2.5 pt-7">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-white truncate max-w-full">
                      <span>📸</span>
                      <span className="truncate">
                        {photo.guest_name || 'Tamu'}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Cursor Pagination Button */}
        {hasMoreByTab[activeTab] && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-5 py-2.5 rounded-full text-xs font-bold bg-neutral-900 hover:bg-neutral-800 border border-white/15 text-neutral-200 flex items-center gap-2"
            >
              {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Muat foto lainnya
            </button>
          </div>
        )}
      </main>

      {/* 4. Floating Action Button (FAB) "Unggah Momen" (Pojok Kanan Bawah dengan Ikon Kamera/Plus) */}
      {!isArchived && (
        <>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleFabClick}
            aria-label="Unggah Momen"
            className="fixed bottom-6 right-5 z-40 flex items-center gap-2.5 pl-3.5 pr-5 py-3.5 rounded-full text-neutral-950 font-extrabold text-sm shadow-[0_10px_30px_rgba(0,0,0,0.6)] border-2 border-white/30 active:scale-95 transition-transform"
            style={{ backgroundColor: themeColor }}
          >
            <div className="relative w-8 h-8 rounded-full bg-black/15 flex items-center justify-center">
              <Camera className="w-4 h-4 stroke-[2.4]" />
              <Plus className="w-3 h-3 stroke-[3] -ml-0.5 -mt-2" />
            </div>
            <span>Unggah Momen</span>
          </button>
        </>
      )}

      {/* 5. Full-Screen Lightbox Modal (Swipe Kiri/Kanan & Tombol Besar "Simpan ke HP") */}
      {activeLightboxPhoto && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between select-none"
          onTouchStart={(e) => {
            touchStartXRef.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartXRef.current === null) return;
            const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
            if (deltaX > 50) handlePrevPhoto();
            if (deltaX < -50) handleNextPhoto();
            touchStartXRef.current = null;
          }}
        >
          {/* Lightbox Top Bar */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {headline}
              </p>
              <p className="text-[11px] text-neutral-400">
                {activeLightboxPhoto.source === 'guest' &&
                activeLightboxPhoto.guest_name
                  ? `📸 Momen dari: ${activeLightboxPhoto.guest_name}`
                  : `Foto ${lightboxIndex + 1} dari ${currentPhotos.length}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Image + Swipe / Arrow Controls */}
          <div className="relative flex-1 flex items-center justify-center px-3 overflow-hidden">
            {currentPhotos.length > 1 && (
              <button
                type="button"
                onClick={handlePrevPhoto}
                className="absolute left-3 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/15"
                aria-label="Foto sebelumnya"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <img
              src={activeLightboxPhoto.url}
              alt="Pratinjau penuh"
              className="max-h-[74vh] max-w-full object-contain rounded-xl shadow-2xl"
            />

            {currentPhotos.length > 1 && (
              <button
                type="button"
                onClick={handleNextPhoto}
                className="absolute right-3 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/15"
                aria-label="Foto berikutnya"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Tombol Besar di Bawah Layar: "Simpan ke HP" */}
          <div className="p-4 border-t border-white/10 bg-neutral-950/90">
            <div className="max-w-md mx-auto">
              <button
                type="button"
                onClick={() => handleDirectDownload(activeLightboxPhoto)}
                className="w-full py-3.5 px-6 rounded-2xl font-extrabold text-sm text-neutral-950 flex items-center justify-center gap-2 shadow-xl active:scale-[0.99] transition"
                style={{ backgroundColor: themeColor }}
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Simpan ke HP</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Dialog Unggah Momen Tamu: Isi Nama Dulu -> Kamera Live Beruntun (Continuous Shot) -> Kirim Semua */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          {!isCameraActive ? (
            /* LANGKAH 1: ISI NAMA DULU SEBELUM MEMBUKA KAMERA */
            <div className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: themeColor }}
                  >
                    Langkah 1 dari 2
                  </span>
                  <h3 className="text-base font-extrabold text-white">
                    Siapa Nama Anda?
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="p-1.5 rounded-full text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-neutral-300">
                Isi nama Anda sebelum membuka kamera agar tercantum pada momen
                foto yang Anda bagikan ✨
              </p>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Nama Anda <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  maxLength={60}
                  placeholder="Contoh: Rangga / Nadia & Tim"
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void startLiveCamera();
                    }
                  }}
                  className="w-full px-3.5 py-3 rounded-xl bg-neutral-950 border border-white/20 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/50"
                />
              </div>

              <p className="text-[11px] text-neutral-400 text-center">
                Sisa kuota unggah Anda: {remainingQuota}/{uploadLimit} foto
              </p>

              <div className="pt-1">
                <button
                  type="button"
                  disabled={!guestNameInput.trim()}
                  onClick={() => void startLiveCamera()}
                  className="w-full py-3.5 px-5 rounded-xl text-xs sm:text-sm font-extrabold text-neutral-950 flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 transition"
                  style={{ backgroundColor: themeColor }}
                >
                  <Camera className="w-4 h-4 stroke-[2.5]" />
                  <span>Buka Kamera Sekarang</span>
                </button>
              </div>
            </div>
          ) : (
            /* LANGKAH 2: KAMERA LIVE BERUNTUN — JEPRET TERUS SAMPAI KUOTA PENUH ATAU KLIK KIRIM */
            <form
              onSubmit={handleConfirmUpload}
              className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-2xl max-h-[94vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider block truncate"
                    style={{ color: themeColor }}
                  >
                    📸 {guestNameInput.trim()} • Sesi Kamera Live
                  </span>
                  <h3 className="text-base font-extrabold text-white">
                    Jepret Terus &amp; Kirim Sekaligus
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                      capturedQueue.length >= remainingQuota
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                        : 'bg-white/10 text-white border-white/15'
                    }`}
                  >
                    {capturedQueue.length}/{remainingQuota} Foto
                  </span>
                  <button
                    type="button"
                    onClick={closeUploadModal}
                    disabled={uploading}
                    className="p-1.5 rounded-full text-neutral-400 hover:text-white disabled:opacity-40"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Viewfinder Kamera Live */}
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center border border-white/15">
                {cameraError ? (
                  <div className="p-6 text-center space-y-3">
                    <p className="text-xs text-amber-300 font-medium leading-relaxed">
                      {cameraError}
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void startLiveCamera()}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-extrabold text-neutral-950 flex items-center justify-center gap-1.5"
                        style={{ backgroundColor: themeColor }}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Coba Hubungkan Lagi</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/15"
                      >
                        Pilih File Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={handleVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${
                        cameraFacingMode === 'user' ? '-scale-x-100' : ''
                      }`}
                    />

                    {/* Efek Flash Putih Saat Jepret */}
                    {shutterFlash && (
                      <div className="
                        absolute inset-0 bg-white/80 pointer-events-none transition-opacity duration-150
                      " />
                    )}

                    {/* Badge Info Kuota Penuh di Atas Kamera */}
                    {capturedQueue.length >= remainingQuota && (
                      <div className="absolute inset-x-3 bottom-3 px-3.5 py-2 rounded-xl bg-black/80 backdrop-blur-md border border-amber-400/40 text-center">
                        <p className="text-xs font-bold text-amber-300">
                          Batas kuota ({remainingQuota} foto) tercapai. Klik Kirim di bawah atau hapus salah satu foto untuk jepret ulang.
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleFlipCamera}
                      disabled={uploading}
                      className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/20 text-xs font-bold text-white flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Putar Kamera</span>
                    </button>
                  </>
                )}
              </div>

              {/* Tray / Filmstrip Hasil Jepretan Beruntun */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>
                    {capturedQueue.length === 0
                      ? 'Belum ada foto dijepret — tekan tombol Jepret di bawah'
                      : `Daftar jepretan siap kirim (${capturedQueue.length} foto)`}
                  </span>
                  {capturedQueue.length > 0 && (
                    <span className="text-neutral-300 font-semibold">
                      Sisa jatah: {Math.max(0, remainingQuota - capturedQueue.length)}
                    </span>
                  )}
                </div>

                {capturedQueue.length > 0 && (
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5">
                    {capturedQueue.map((shot, idx) => (
                      <div
                        key={shot.id}
                        className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden border border-white/20 bg-neutral-950 shrink-0 group"
                      >
                        <img
                          src={shot.previewUrl}
                          alt={`Jepretan ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-black/75 text-[9px] font-bold text-white">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => handleRemoveCapturedShot(shot.id)}
                          aria-label={`Hapus foto ${idx + 1}`}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 hover:bg-red-600 text-white flex items-center justify-center border border-white/20 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Bar: Ubah Nama | Jepret Foto Terus | Kirim Sekaligus */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={stopLiveCamera}
                  className="px-3 py-3.5 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 disabled:opacity-40 shrink-0"
                >
                  &larr; Nama
                </button>

                {!cameraError && (
                  <button
                    type="button"
                    disabled={uploading || capturedQueue.length >= remainingQuota}
                    onClick={handleCapturePhotoFromStream}
                    className={`flex-1 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition ${
                      capturedQueue.length >= remainingQuota
                        ? 'bg-neutral-800 text-neutral-500 border border-white/10 cursor-not-allowed'
                        : capturedQueue.length > 0
                        ? 'bg-white text-neutral-950 hover:bg-neutral-200'
                        : 'text-neutral-950'
                    }`}
                    style={
                      capturedQueue.length === 0 &&
                      capturedQueue.length < remainingQuota
                        ? { backgroundColor: themeColor }
                        : undefined
                    }
                  >
                    <Camera className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {capturedQueue.length >= remainingQuota
                        ? 'Kuota Penuh'
                        : capturedQueue.length > 0
                        ? 'Jepret Lagi'
                        : 'Jepret Foto'}
                    </span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={uploading || capturedQueue.length === 0}
                  className="flex-1 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold text-neutral-950 flex items-center justify-center gap-1.5 shadow-xl disabled:opacity-35 active:scale-95 transition"
                  style={{ backgroundColor: themeColor }}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        Kirim{capturedQueue.length > 0 ? ` (${capturedQueue.length})` : ''}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
