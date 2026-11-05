'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const [usedQuota, setUsedQuota] = useState(0);
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

  useEffect(() => {
    let mounted = true;
    setUsedQuota(getLocalGuestUploadCount(slug));

    async function loadInitial() {
      setLoading(true);

      let urlLimit: number | undefined;
      if (typeof window !== 'undefined') {
        const sp = new URLSearchParams(window.location.search);
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
        if (mounted && arch) setArchiveInfo(arch);
      }

      setLoading(false);
    }

    void loadInitial();

    // Periodic sync every 4s to guarantee real-time updates across cellular and Wi-Fi networks
    const guestSyncTimer = setInterval(async () => {
      try {
        const [mainRes, guestRes] = await Promise.all([
          fetchEventPhotos(slug, { limit: 30, source: 'photographer' }),
          fetchEventPhotos(slug, { limit: 30, source: 'guest' }),
        ]);
        if (!mounted) return;
        setPhotosByTab((prev) => {
          const mapPhoto = new Map<string, PhotoItem>();
          for (const p of mainRes.data || []) mapPhoto.set(p.id, p);
          for (const p of prev.photographer) {
            if (!mapPhoto.has(p.id)) mapPhoto.set(p.id, p);
          }

          const mapGuest = new Map<string, PhotoItem>();
          for (const p of guestRes.data || []) mapGuest.set(p.id, p);
          for (const p of prev.guest) {
            if (!mapGuest.has(p.id)) mapGuest.set(p.id, p);
          }

          return {
            photographer: Array.from(mapPhoto.values()),
            guest: Array.from(mapGuest.values()),
          };
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

        const presigned = await requestGuestPresignedUrl(slug, {
          filename: optimizedFile.name,
          content_type: optimizedFile.type || 'image/jpeg',
          guest_identifier: guestIdentifier,
        });

        await uploadFileToPresignedUrl(presigned.upload_url, optimizedFile);

        const confirmed = await confirmGuestPhotoUpload(slug, {
          file_key: presigned.file_key,
          guest_identifier: guestIdentifier,
          guest_name: guestName.trim() || undefined,
        });

        if (confirmed?.data) {
          addLocalEventPhoto(slug, confirmed.data);
          setPhotosByTab((prev) => ({
            ...prev,
            guest: [
              confirmed.data!,
              ...prev.guest.filter((p) => p.id !== confirmed.data!.id),
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
      console.warn('Cloud guest upload deferred to local:', err);
    }

    // Fallback to local storage if offline or disconnected
    const newDemoPhotos: PhotoItem[] = [];
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
        guest_name: guestName.trim() || 'Tamu',
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
    setActiveTab('guest');
    showToast(
      `${totalSent} foto berhasil disimpan di galeri offline.`,
      'success',
    );
  };

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
  };
}

