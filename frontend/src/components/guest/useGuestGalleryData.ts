'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  saveLocalEventCustomization,
  subscribeLocalLiveEvents,
  uploadFileToPresignedUrl,
  uploadPhotoDirectly,
} from '@/lib/api';
import { createEventSocket } from '@/lib/socket';
import { compressImageUnder2MB } from '@/lib/image-compress';
import {
  ArchiveStatus,
  PhotoItem,
  PhotoSource,
  PublicEvent,
} from '@/lib/types';
import {
  CapturedShot,
  DEFAULT_DEMO_HEADER_PHOTO,
  DEMO_PHOTOS,
  formatDemoEventTitle,
} from './guestGalleryConstants';

export function useGuestGalleryData(slug: string) {
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PhotoSource>('guest');

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

  const [usedQuota, setUsedQuota] = useState(0);
  const [archiveInfo, setArchiveInfo] = useState<{
    status: ArchiveStatus;
    download_url: string | null;
  }>({ status: 'none', download_url: null });

  const [guestIdentifier, setGuestIdentifier] = useState<string>('');
  const [guestViewFilter, setGuestViewFilter] = useState<'all' | 'my_photos'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const showToast = useCallback(
    (text: string, type: 'success' | 'info' | 'warning' = 'info') => {
      setToast({ text, type });
      setTimeout(() => {
        setToast((prev) => (prev?.text === text ? null : prev));
      }, 3600);
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    let isLocalOnlyEvent = false;
    setUsedQuota(getLocalGuestUploadCount(slug));
    setGuestIdentifier(getOrCreateGuestIdentifier());

    async function loadInitial() {
      setLoading(true);

      let urlLimit: number | undefined;
      if (typeof window !== 'undefined') {
        const sp = new URLSearchParams(window.location.search);
        const urlTab = sp.get('tab');
        if (urlTab === 'photographer' || urlTab === 'guest') {
          setActiveTab(urlTab);
        }
        const rawLimit = sp.get('limit');
        if (rawLimit) {
          const parsedLimit = parseInt(rawLimit, 10);
          if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
            urlLimit = parsedLimit;
            saveLocalEventCustomization(slug, {
              guest_upload_limit: parsedLimit,
            });
          }
        }
      }

      const fetchedEvent = await fetchPublicEvent(slug);
      if (!mounted) return;

      const localCustom = getLocalEventCustomization(slug);
      const resolvedLimit =
        urlLimit ??
        (typeof localCustom?.guest_upload_limit === 'number' &&
        localCustom.guest_upload_limit > 0
          ? localCustom.guest_upload_limit
          : undefined) ??
        fetchedEvent?.guest_upload_limit ??
        5;

      if (!fetchedEvent) {
        isLocalOnlyEvent = true;
        setIsDemoMode(true);
        const resolvedStatus = localCustom?.status || 'active';
        setEvent({
          id: 'demo-event-id',
          name: localCustom?.name || formatDemoEventTitle(slug),
          header_subtitle:
            localCustom?.header_subtitle !== undefined
              ? localCustom.header_subtitle
              : 'The Wedding of',
          slug,
          status: resolvedStatus,
          theme_color: localCustom?.theme_color || '#D4AF37',
          header_image_url:
            localCustom?.header_image_url !== undefined
              ? localCustom.header_image_url
              : DEFAULT_DEMO_HEADER_PHOTO,
          guest_upload_limit: resolvedLimit,
          is_upload_allowed: resolvedStatus === 'active',
        });
        const localPhotos = getLocalEventPhotos(slug);
        setPhotosByTab({
          photographer: [
            ...localPhotos.filter((p) => p.source === 'photographer'),
            ...(slug === 'budi-ani' ? DEMO_PHOTOS.photographer : []),
          ],
          guest: [
            ...localPhotos.filter((p) => p.source === 'guest'),
            ...(slug === 'budi-ani' ? DEMO_PHOTOS.guest : []),
          ],
        });
        setLoading(false);
        return;
      }

      setEvent({
        ...fetchedEvent,
        name: localCustom?.name || fetchedEvent.name,
        header_subtitle:
          localCustom?.header_subtitle !== undefined
            ? localCustom.header_subtitle
            : (fetchedEvent.header_subtitle ?? 'The Wedding of'),
        theme_color: localCustom?.theme_color || fetchedEvent.theme_color,
        header_image_url:
          fetchedEvent.header_image_url ||
          localCustom?.header_image_url ||
          null,
        guest_upload_limit: resolvedLimit,
      });

      const [mainRes, guestRes] = await Promise.all([
        fetchEventPhotos(slug, { limit: 30, source: 'photographer' }),
        fetchEventPhotos(slug, { limit: 30, source: 'guest' }),
      ]);

      if (!mounted) return;

      // Real events: server is the single source of truth (no device-only photos)
      setPhotosByTab({
        photographer: mainRes.data || [],
        guest: guestRes.data || [],
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
        if (mounted && arch) setArchiveInfo(arch);
      }

      setLoading(false);
    }

    void loadInitial();

    // Periodic sync every 4s to guarantee real-time updates across cellular and Wi-Fi networks
    const guestSyncTimer = setInterval(async () => {
      if (isLocalOnlyEvent) return;
      try {
        const [mainRes, guestRes] = await Promise.all([
          fetchEventPhotos(slug, { limit: 30, source: 'photographer' }),
          fetchEventPhotos(slug, { limit: 30, source: 'guest' }),
        ]);
        if (!mounted || !mainRes.success || !guestRes.success) return;
        setPhotosByTab({
          photographer: mainRes.data || [],
          guest: guestRes.data || [],
        });
      } catch {
        // Ignore network hiccup
      }
    }, 4000);

    return () => {
      mounted = false;
      clearInterval(guestSyncTimer);
    };
  }, [slug]);

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
          return { photographer: nextPhotographer, guest: nextGuest };
        });

        showToast(
          batch.length > 1
            ? `${batch.length} foto baru telah ditambahkan ke galeri`
            : 'Foto baru telah ditambahkan ke galeri',
          'info',
        );
      }, 350);
    };

    const unsubLocal = subscribeLocalLiveEvents(slug, {
      onNewPhoto: enqueueIncomingPhoto,
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

  useEffect(() => {
    if (event?.status !== 'archived' || isDemoMode) return;
    if (archiveInfo.status === 'ready') return;

    const timer = setInterval(async () => {
      const arch = await fetchEventArchiveStatus(slug);
      if (arch) setArchiveInfo(arch);
    }, 5000);

    return () => clearInterval(timer);
  }, [event?.status, archiveInfo.status, slug, isDemoMode]);

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

  const uploadGuestQueue = async (
    capturedQueue: CapturedShot[],
    guestName: string,
  ) => {
    const guestIdentifier = getOrCreateGuestIdentifier();
    const totalSent = capturedQueue.length;

    let latestQuota = usedQuota;

    try {
      for (const item of capturedQueue) {
        // Compress under 2MB while preserving 2.5K high-resolution fidelity
        const optimizedFile = await compressImageUnder2MB(item.file);
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(item.previewUrl);
          reader.readAsDataURL(optimizedFile);
        });

        // Atomic direct upload directly into Cloudflare R2 & Neon DB
        const confirmed = await uploadPhotoDirectly(slug, {
          file_data: dataUrl,
          guest_name: guestName.trim() || undefined,
          guest_identifier: guestIdentifier,
          source: 'guest',
        });

        if (confirmed?.data) {
          addLocalEventPhoto(slug, confirmed.data);
          setPhotosByTab((prev) => ({
            ...prev,
            guest: [
              confirmed.data,
              ...prev.guest.filter((p) => p.id !== confirmed.data.id),
            ],
          }));
        }

        latestQuota = incrementLocalGuestUploadCount(slug);
      }

      setUsedQuota(latestQuota);
      setActiveTab('guest');
      showToast(
        `${totalSent} foto berhasil diunggah ke galeri acara.`,
        'success',
      );
      return;
    } catch (err) {
      console.warn('Direct upload failed:', err);
      setUsedQuota(latestQuota);
      throw new Error('Foto gagal terkirim. Cek sinyal, lalu coba lagi.');
    }
  };

  const myPhotosCount = useMemo(() => {
    if (!guestIdentifier) return 0;
    return photosByTab.guest.filter(
      (p) => p.guest_identifier === guestIdentifier,
    ).length;
  }, [photosByTab.guest, guestIdentifier]);

  const filteredGuestPhotos = useMemo(() => {
    let list = photosByTab.guest;
    if (guestViewFilter === 'my_photos' && guestIdentifier) {
      list = list.filter((p) => p.guest_identifier === guestIdentifier);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((p) => (p.guest_name || '').toLowerCase().includes(q));
    }
    return list;
  }, [photosByTab.guest, guestViewFilter, guestIdentifier, searchQuery]);

  return {
    event,
    loading,
    activeTab,
    setActiveTab,
    photosByTab,
    hasMoreByTab,
    loadingMore,
    handleLoadMore,
    toast,
    showToast,
    usedQuota,
    archiveInfo,
    uploadGuestQueue,
    guestIdentifier,
    guestViewFilter,
    setGuestViewFilter,
    searchQuery,
    setSearchQuery,
    myPhotosCount,
    filteredGuestPhotos,
  };
}

