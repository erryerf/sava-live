'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FolderSync,
  KeyRound,
  Loader2,
  Pencil,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  compositePhotoWithFrameFile,
  generatePolaroidFrameFile,
} from '@/lib/frame-generator';
import { QRCodeCanvas } from 'qrcode.react';
import {
  deleteAdminPhoto,
  fetchAdminEventById,
  fetchAdminEventPhotos,
  moderateAdminPhoto,
  resetAdminFtpPassword,
  triggerAdminArchive,
  updateAdminEvent,
  updateAdminEventStatus,
  uploadAdminCustomFrame,
  uploadAdminHeaderImage,
} from '@/lib/admin-api';
import {
  addLocalEventPhoto,
  broadcastLocalEventUpdated,
  confirmGuestPhotoUpload,
  getLocalEventCustomization,
  getLocalEventPhotos,
  removeLocalEventPhoto,
  requestGuestPresignedUrl,
  saveLocalEventCustomization,
  subscribeLocalLiveEvents,
  uploadFileToPresignedUrl,
  uploadPhotoDirectly,
} from '@/lib/api';
import { createEventSocket } from '@/lib/socket';
import { compressImageUnder2MB } from '@/lib/image-compress';
import { AdminEvent, PhotoItem, PhotoSource } from '@/lib/types';
import {
  DEMO_ADMIN_PHOTOS,
  getStoredDemoEvents,
  saveStoredDemoEvents,
} from './demo-data';

function formatPolaroidDate(isoString?: string | null): string {
  if (!isoString) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
  }
  try {
    const dt = new Date(isoString);
    if (isNaN(dt.getTime())) return '26/06/2026';
    const d = String(dt.getDate()).padStart(2, '0');
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const y = dt.getFullYear();
    return `${d}/${m}/${y}`;
  } catch {
    return '26/06/2026';
  }
}

interface EventControlRoomProps {
  selectedEvent: AdminEvent;
  isDemoMode: boolean;
  originUrl: string;
  onBack: () => void;
  onEventUpdated: (updated: AdminEvent) => void;
  onOpenEditModal: (evt: AdminEvent) => void;
  onOpenDeleteModal: (evt: AdminEvent) => void;
  onReloadEvents: () => Promise<void>;
  showToast: (msg: string) => void;
}

export default function EventControlRoom({
  selectedEvent,
  isDemoMode,
  originUrl,
  onBack,
  onEventUpdated,
  onOpenEditModal,
  onOpenDeleteModal,
  onReloadEvents,
  showToast,
}: EventControlRoomProps) {
  const [eventPhotos, setEventPhotos] = useState<PhotoItem[]>([]);
  const [controlTab, setControlTab] = useState<'gallery' | 'moderation'>(
    'gallery',
  );
  const [gallerySourceFilter, setGallerySourceFilter] = useState<
    'all' | PhotoSource
  >('all');
  const [generatedFtpPassword, setGeneratedFtpPassword] = useState<
    string | null
  >(null);
  const [editHeaderSubtitle, setEditHeaderSubtitle] =
    useState('The Wedding of');
  const [editEventName, setEditEventName] = useState('');
  const [uploadingMainPhotos, setUploadingMainPhotos] = useState(false);
  const [watchedFolderName, setWatchedFolderName] = useState<string | null>(
    null,
  );
  const [showFtpAdvanced, setShowFtpAdvanced] = useState(true);
  const [bridgeStatus, setBridgeStatus] = useState<{
    online: boolean;
    local_ip: string;
    ftp_port: number;
    hot_folder: string;
    active_sessions: number;
  } | null>(null);
  const [simulatingShot, setSimulatingShot] = useState(false);
  const [uploadingFrame, setUploadingFrame] = useState(false);
  const [frameTab, setFrameTab] = useState<'default_polaroid' | 'custom_upload'>(
    'default_polaroid',
  );
  const [polaroidName, setPolaroidName] = useState(selectedEvent.name || '');
  const [polaroidDate, setPolaroidDate] = useState(() =>
    formatPolaroidDate(selectedEvent.start_time),
  );
  const [generatingPolaroid, setGeneratingPolaroid] = useState(false);

  const qrCanvasRef = useRef<HTMLDivElement | null>(null);
  const folderWatchTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const syncedFileNamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      if (folderWatchTimerRef.current) {
        clearInterval(folderWatchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const localCustom = getLocalEventCustomization(selectedEvent.slug);
    setEditEventName(localCustom?.name || selectedEvent.name);
    setPolaroidName(localCustom?.name || selectedEvent.name || '');
    setPolaroidDate(formatPolaroidDate(selectedEvent.start_time));
    setEditHeaderSubtitle(
      localCustom?.header_subtitle !== undefined
        ? (localCustom.header_subtitle ?? '')
        : (selectedEvent.header_subtitle ?? 'The Wedding of'),
    );

    async function loadControlRoomPhotos() {
      if (!isDemoMode) {
        // Real events: show exactly what the server has (same as guests see)
        const list = await fetchAdminEventPhotos(
          selectedEvent.id || selectedEvent.slug,
        ).catch(() => null);
        if (list) setEventPhotos(list);
        return;
      }

      const localPhotos = getLocalEventPhotos(selectedEvent.slug);
      if (selectedEvent.slug === 'budi-ani') {
        setEventPhotos([...localPhotos, ...DEMO_ADMIN_PHOTOS]);
      } else {
        setEventPhotos(localPhotos);
      }
    }

    async function loadBridgeStatus() {
      if (typeof window === 'undefined' || window.location.hostname !== 'localhost') {
        return;
      }
      try {
        const res = await fetch(
          `http://localhost:3001/v1/bridge-status?slug=${encodeURIComponent(selectedEvent.slug)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setBridgeStatus(data);
        }
      } catch {
        setBridgeStatus(null);
      }
    }

    void loadControlRoomPhotos();
    void loadBridgeStatus();

    // Auto-sync control room gallery every 3.5 seconds across all devices
    const syncTimer = setInterval(() => {
      void loadControlRoomPhotos();
      void loadBridgeStatus();
    }, 3500);

    const unsubLocal = subscribeLocalLiveEvents(selectedEvent.slug, {
      onNewPhoto: (photo) => {
        setEventPhotos((prev) => {
          if (prev.some((p) => p.id === photo.id)) return prev;
          return [{ ...photo, status: 'approved' }, ...prev];
        });
      },
      onPhotoDeleted: (photoId) => {
        setEventPhotos((prev) => prev.filter((p) => p.id !== photoId));
      },
    });

    const socket = createEventSocket(selectedEvent.slug);
    socket.on('NEW_PHOTO', (rawPayload: unknown) => {
      if (
        rawPayload &&
        typeof rawPayload === 'object' &&
        'slug' in rawPayload &&
        typeof (rawPayload as { slug?: unknown }).slug === 'string' &&
        (rawPayload as { slug: string }).slug !== selectedEvent.slug
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

      if (!payload || !payload.id) return;
      setEventPhotos((prev) => {
        if (prev.some((p) => p.id === payload.id)) return prev;
        return [{ ...payload, status: 'approved' }, ...prev];
      });
    });

    socket.on('PHOTO_DELETED', (rawPayload: unknown) => {
      const data =
        rawPayload && typeof rawPayload === 'object' && 'data' in rawPayload
          ? (rawPayload as { data: { id: string } }).data
          : (rawPayload as { id: string });
      if (!data?.id) return;
      setEventPhotos((prev) => prev.filter((p) => p.id !== data.id));
    });

    return () => {
      clearInterval(syncTimer);
      unsubLocal();
      socket.disconnect();
    };
  }, [
    selectedEvent.id,
    selectedEvent.slug,
    selectedEvent.name,
    selectedEvent.header_subtitle,
    isDemoMode,
  ]);

  const createSimulatedTestShotFile = async (slug: string): Promise<File> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1066;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas tidak didukung');

    const grad = ctx.createLinearGradient(0, 0, 1600, 1066);
    grad.addColorStop(0, '#1c1917');
    grad.addColorStop(0.5, '#292524');
    grad.addColorStop(1, '#0c0a09');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1600, 1066);

    ctx.beginPath();
    ctx.arc(800, 533, 380, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'italic 40px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Live Auto-Transfer Shot', 800, 450);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText(`Kamera Fotografer (${slug})`, 800, 545);

    ctx.fillStyle = '#a8a29e';
    ctx.font = '28px sans-serif';
    const timeStr = new Date().toLocaleTimeString('id-ID');
    ctx.fillText(`Simulasi Bidikan Otomatis • ${timeStr}`, 800, 630);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88),
    );
    if (!blob) throw new Error('Pembuatan gambar simulasi gagal');
    return new File([blob], `DSC_${Date.now().toString().slice(-4)}.jpg`, {
      type: 'image/jpeg',
    });
  };

  const processSinglePhotographerFile = async (file: File) => {
    // Compress under 2MB while keeping 2.5K high resolution for live wall & prints
    // Note: Photos are preserved cleanly without baking frames, allowing flexible frame toggling!
    const optimizedFile = await compressImageUnder2MB(file);

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(optimizedFile);
    });

    const localPhoto: PhotoItem = {
      id: `main-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: dataUrl,
      source: 'photographer',
      guest_name: null,
      status: 'approved',
      created_at: new Date().toISOString(),
    };

    setEventPhotos((prev) => [localPhoto, ...prev]);

    try {
      const confirmed = await uploadPhotoDirectly(selectedEvent.slug, {
        file_data: dataUrl,
        guest_identifier: `admin_photographer_${Date.now()}`,
        source: 'photographer',
      });

      const savedPhoto: PhotoItem = confirmed?.data || {
        ...localPhoto,
      };

      addLocalEventPhoto(selectedEvent.slug, savedPhoto);
      setEventPhotos((prev) => [
        savedPhoto,
        ...prev.filter((p) => p.id !== localPhoto.id && p.id !== savedPhoto.id),
      ]);
    } catch (err) {
      console.warn('Photographer cloud upload deferred to local:', err);
      addLocalEventPhoto(selectedEvent.slug, localPhoto);
    }
  };

  const handleMainCameraFilesUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadingMainPhotos(true);
    try {
      const files = Array.from(fileList);
      for (const file of files) {
        await processSinglePhotographerFile(file);
      }
      showToast(
        `${files.length} foto Kamera Utama berhasil ditayangkan ke Live Wall! 📸`,
      );
    } catch {
      showToast('Gagal memproses sebagian foto.');
    } finally {
      setUploadingMainPhotos(false);
    }
  };

  const handleToggleFolderSync = async () => {
    if (watchedFolderName) {
      if (folderWatchTimerRef.current) {
        clearInterval(folderWatchTimerRef.current);
        folderWatchTimerRef.current = null;
      }
      setWatchedFolderName(null);
      showToast('Auto-Sync Folder Kamera dihentikan.');
      return;
    }

    const win = window as Window & {
      showDirectoryPicker?: () => Promise<{
        name: string;
        values: () => AsyncIterable<{
          kind: string;
          name: string;
          getFile: () => Promise<File>;
        }>;
      }>;
    };

    if (!win.showDirectoryPicker) {
      showToast(
        'Gunakan Chrome atau Edge untuk fitur Auto-Sync Folder Kabel USB.',
      );
      return;
    }

    try {
      const dirHandle = await win.showDirectoryPicker();
      setWatchedFolderName(dirHandle.name);
      syncedFileNamesRef.current = new Set();

      // Initial scan: mark existing files or sync new ones
      for await (const entry of dirHandle.values()) {
        if (
          entry.kind === 'file' &&
          /\.(jpe?g|png|webp)$/i.test(entry.name)
        ) {
          syncedFileNamesRef.current.add(entry.name);
        }
      }

      showToast(
        `Folder "${dirHandle.name}" terhubung! Jepretan baru akan otomatis masuk ke layar ✨`,
      );

      folderWatchTimerRef.current = setInterval(async () => {
        try {
          for await (const entry of dirHandle.values()) {
            if (
              entry.kind === 'file' &&
              /\.(jpe?g|png|webp)$/i.test(entry.name) &&
              !syncedFileNamesRef.current.has(entry.name)
            ) {
              syncedFileNamesRef.current.add(entry.name);
              const file = await entry.getFile();
              await processSinglePhotographerFile(file);
              showToast(`Foto baru "${entry.name}" otomatis tayang! 📸`);
            }
          }
        } catch {
          // Ignore transient read errors while camera writes file
        }
      }, 2500);
    } catch {
      // User cancelled directory picker
    }
  };

  const copyText = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    showToast(`${label} disalin!`);
  };

  const downloadQrCodePng = (slug: string) => {
    const canvas = qrCanvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${slug}.png`;
    a.click();
    showToast('QR Code diunduh!');
  };

  const handleResetFtpPassword = async () => {
    try {
      if (isDemoMode) {
        const newPass = Math.random().toString(36).slice(2, 10);
        setGeneratedFtpPassword(newPass);
        showToast('Password FTP baru dibuat!');
        return;
      }
      const res = await resetAdminFtpPassword(selectedEvent.id);
      setGeneratedFtpPassword(res.password);
      showToast('Password FTP berhasil direset!');
    } catch (err) {
      showToast((err as Error).message || 'Gagal mereset password FTP.');
    }
  };

  const handleHeaderPhotoChange = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!dataUrl) return;

      saveLocalEventCustomization(selectedEvent.slug, {
        name: selectedEvent.name,
        theme_color: selectedEvent.theme_color,
        header_image_url: dataUrl,
      });

      const updatedEvt: AdminEvent = {
        ...selectedEvent,
        header_image_url: dataUrl,
      };
      onEventUpdated(updatedEvt);

      if (isDemoMode) {
        const allDemo = getStoredDemoEvents().map((item) =>
          item.id === selectedEvent.id ? updatedEvt : item,
        );
        saveStoredDemoEvents(allDemo);
      } else {
        try {
          await uploadAdminHeaderImage(selectedEvent.id, file);
        } catch {
          // Kept in localStorage if R2 bucket is offline locally
        }
      }
      showToast('Foto header berhasil diperbarui! ✨');
    };
    reader.readAsDataURL(file);
  };

  const handleFrameFileChange = (file: File | null) => {
    if (!file) return;
    if (file.type && !file.type.includes('png') && !file.name.toLowerCase().endsWith('.png')) {
      showToast('Gunakan file berformat .PNG transparan.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!dataUrl) return;

      saveLocalEventCustomization(selectedEvent.slug, {
        custom_frame_url: dataUrl,
        custom_frame_key: `events/${selectedEvent.slug}/frames/${file.name}`,
      });

      const updatedEvt: AdminEvent = {
        ...selectedEvent,
        custom_frame_url: dataUrl,
        custom_frame_key: `events/${selectedEvent.slug}/frames/${file.name}`,
      };
      onEventUpdated(updatedEvt);
      broadcastLocalEventUpdated(selectedEvent.slug, {
        custom_frame_url: dataUrl,
        custom_frame_key: `events/${selectedEvent.slug}/frames/${file.name}`,
      });

      if (isDemoMode) {
        const allDemo = getStoredDemoEvents().map((item) =>
          item.id === selectedEvent.id ? updatedEvt : item,
        );
        saveStoredDemoEvents(allDemo);
        showToast('Bingkai digital .PNG berhasil dipasang! 🖼️');
      } else {
        try {
          setUploadingFrame(true);
          const res = await uploadAdminCustomFrame(selectedEvent.id, file);
          const serverEvt: AdminEvent = {
            ...selectedEvent,
            custom_frame_key: res.file_key,
            custom_frame_url: res.public_url || dataUrl,
          };
          onEventUpdated(serverEvt);
          saveLocalEventCustomization(selectedEvent.slug, {
            custom_frame_key: res.file_key,
            custom_frame_url: res.public_url || dataUrl,
          });
          broadcastLocalEventUpdated(selectedEvent.slug, {
            custom_frame_key: res.file_key,
            custom_frame_url: res.public_url || dataUrl,
          });
          showToast('Bingkai digital .PNG berhasil diunggah! 🖼️');
        } catch (err) {
          console.warn('Frame upload error:', err);
          showToast('Bingkai tersimpan lokal.');
        } finally {
          setUploadingFrame(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyDefaultPolaroid = async () => {
    if (generatingPolaroid) return;
    setGeneratingPolaroid(true);
    try {
      const file = await generatePolaroidFrameFile(
        {
          names: polaroidName.trim() || selectedEvent.name,
          date: polaroidDate.trim(),
        },
        `polaroid-${selectedEvent.slug}.png`,
      );
      handleFrameFileChange(file);
      showToast('Bingkai Polaroid diterapkan ke seluruh galeri & Live Wall! ✨');
    } catch (err) {
      showToast((err as Error).message || 'Gagal membuat bingkai Polaroid.');
    } finally {
      setGeneratingPolaroid(false);
    }
  };

  const handleRemoveFrame = async () => {
    saveLocalEventCustomization(selectedEvent.slug, {
      custom_frame_url: null,
      custom_frame_key: null,
    });
    const updatedEvt: AdminEvent = {
      ...selectedEvent,
      custom_frame_url: null,
      custom_frame_key: null,
    };
    onEventUpdated(updatedEvt);
    broadcastLocalEventUpdated(selectedEvent.slug, {
      custom_frame_url: null,
      custom_frame_key: null,
    });

    if (isDemoMode) {
      const allDemo = getStoredDemoEvents().map((item) =>
        item.id === selectedEvent.id ? updatedEvt : item,
      );
      saveStoredDemoEvents(allDemo);
    } else {
      try {
        await updateAdminEvent(selectedEvent.id, {
          custom_frame_key: null,
        });
      } catch {
        // kept locally
      }
    }
    showToast('Bingkai digital dihapus.');
  };

  const handleSaveHeaderTexts = async () => {
    const cleanName = editEventName.trim() || selectedEvent.name;
    const cleanSub = editHeaderSubtitle.trim();
    saveLocalEventCustomization(selectedEvent.slug, {
      name: cleanName,
      header_subtitle: cleanSub,
    });
    const updatedEvt: AdminEvent = {
      ...selectedEvent,
      name: cleanName,
      header_subtitle: cleanSub,
    };
    onEventUpdated(updatedEvt);

    if (isDemoMode) {
      const allDemo = getStoredDemoEvents().map((item) =>
        item.id === selectedEvent.id ? updatedEvt : item,
      );
      saveStoredDemoEvents(allDemo);
    } else {
      try {
        await updateAdminEvent(selectedEvent.id, {
          name: cleanName,
          header_subtitle: cleanSub,
        });
      } catch {
        // Kept in localStorage if offline
      }
    }
    showToast('Teks header berhasil disimpan! ✨');
  };

  const handleEndEventAndGenerateZip = async () => {
    try {
      if (isDemoMode) {
        const updated: AdminEvent = {
          ...selectedEvent,
          status: 'archived',
          is_upload_allowed: false,
          archive_status: 'ready',
          archive_download_url: `https://cdn.domainanda.com/events/${selectedEvent.slug}/archives/${selectedEvent.slug}-all.zip`,
          ftp_credentials: selectedEvent.ftp_credentials
            ? { ...selectedEvent.ftp_credentials, is_active: false }
            : undefined,
        };
        onEventUpdated(updated);
        const updatedList = getStoredDemoEvents().map((item) =>
          item.id === selectedEvent.id ? updated : item,
        );
        saveStoredDemoEvents(updatedList);
        showToast('Event diakhiri & ZIP siap diunduh! 📦');
        return;
      }

      await updateAdminEventStatus(selectedEvent.id, 'archived');
      await triggerAdminArchive(selectedEvent.id);
      const refreshed = await fetchAdminEventById(selectedEvent.id);
      onEventUpdated(refreshed);
      await onReloadEvents();
      showToast('Event diakhiri. Pembuatan ZIP dimulai! 📦');
    } catch (err) {
      showToast((err as Error).message || 'Gagal mengakhiri event.');
    }
  };

  const handleModeratePhoto = async (
    photoId: string,
    status: 'approved' | 'rejected',
  ) => {
    try {
      if (!isDemoMode) {
        await moderateAdminPhoto(selectedEvent.id, photoId, status);
      }
      setEventPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, status } : p)),
      );
      showToast(status === 'approved' ? 'Foto disetujui! ✅' : 'Foto ditolak.');
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const handleForceDeletePhoto = async (photoId: string) => {
    try {
      if (!isDemoMode) {
        await deleteAdminPhoto(selectedEvent.id, photoId).catch(() => { });
      }
      removeLocalEventPhoto(selectedEvent.slug, photoId);
      setEventPhotos((prev) => prev.filter((p) => p.id !== photoId));
      showToast('Foto dihapus permanen.');
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const pendingPhotos = eventPhotos.filter((p) => p.status === 'pending');
  const approvedPhotos = eventPhotos.filter(
    (p) =>
      p.status !== 'rejected' &&
      (gallerySourceFilter === 'all' || p.source === gallerySourceFilter),
  );

  const currentHeaderImage =
    selectedEvent.header_image_url ||
    getLocalEventCustomization(selectedEvent.slug)?.header_image_url ||
    null;

  const currentFrameImage =
    selectedEvent.custom_frame_url ||
    getLocalEventCustomization(selectedEvent.slug)?.custom_frame_url ||
    null;

  const cloudFtpHost =
    process.env.NEXT_PUBLIC_FTP_HOST ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? window.location.hostname
      : bridgeStatus?.local_ip || 'ftp.sava-app.cloud');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Control Room Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-white/[0.07]">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-neutral-400 hover:text-white mb-1 inline-block transition-colors"
          >
            &larr; Daftar Acara
          </button>
          <div className="flex items-center gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: selectedEvent.theme_color }}
            />
            <h1 className="text-2xl font-semibold tracking-tight text-[#F5F4F0]">
              {selectedEvent.name}
            </h1>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-medium ${selectedEvent.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/[0.05] text-neutral-400 border border-white/[0.08]'
                }`}
            >
              {selectedEvent.status === 'active' ? 'Berlangsung' : 'Selesai'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenEditModal(selectedEvent)}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#141413] hover:bg-[#1E1E1C] border border-white/[0.08] flex items-center gap-1.5 text-neutral-200 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-neutral-400" />
            <span>Pengaturan</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenDeleteModal(selectedEvent)}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#141413] hover:bg-rose-950/60 border border-white/[0.08] flex items-center gap-1.5 text-neutral-400 hover:text-rose-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus</span>
          </button>
          <Link
            href={`/${selectedEvent.slug}?limit=${selectedEvent.guest_upload_limit}`}
            target="_blank"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#141413] hover:bg-[#1E1E1C] border border-white/[0.08] flex items-center gap-1.5 text-neutral-200 transition-colors"
          >
            <span>Galeri Tamu</span>
            <ExternalLink className="w-3 h-3 text-neutral-500" />
          </Link>
          <Link
            href={`/live/${selectedEvent.slug}`}
            target="_blank"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] flex items-center gap-1.5 transition-colors"
          >
            <span>Buka Live Wall</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Control Room 2-Column Layout */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (4 cols): FTP Status, Header Settings, QR Code, End Event */}
        <div className="lg:col-span-4 space-y-5">
          {/* 1. Kamera Utama Fotografer: Auto-Upload Saat Memotret (Wi-Fi FTP / Kabel USB) */}
          <div className="p-5 rounded-lg bg-[#121211] border border-white/[0.07] space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                Transmisi Kamera Utama
              </span>
              {bridgeStatus?.online ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Wifi className="w-3 h-3" />
                  Port {bridgeStatus.ftp_port}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-white/[0.05] text-neutral-300">
                  <Camera className="w-3 h-3" />
                  Siaga
                </span>
              )}
            </div>

            {/* Panel Auto-Upload Saat Fotografer Memotret */}
            <div className="p-3.5 rounded-md bg-[#0B0B0A] border border-white/[0.07] space-y-2.5 text-xs">
              <div className="font-medium text-[#F5F4F0] flex items-center justify-between">
                <span>1. Wi-Fi Kamera (FTP Transfer)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-300">
                  Otomatis
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Masukkan konfigurasi berikut pada menu{' '}
                <strong className="text-neutral-200">FTP Transfer</strong>{' '}
                kamera:
              </p>
              <div className="space-y-1.5 font-mono text-[11px] pt-2 border-t border-white/[0.06]">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Host / IP:</span>
                  <button
                    type="button"
                    onClick={() => copyText(cloudFtpHost, 'Host Server FTP')}
                    className="text-neutral-200 hover:text-white flex items-center gap-1"
                  >
                    <span>{cloudFtpHost}</span>
                    <Copy className="w-3 h-3 text-neutral-500" />
                  </button>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Port:</span>
                  <span className="text-neutral-200">
                    {bridgeStatus?.ftp_port || 2121}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Username:</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(selectedEvent.slug, 'Username FTP')
                    }
                    className="text-neutral-200 hover:text-white flex items-center gap-1"
                  >
                    <span>{selectedEvent.slug}</span>
                    <Copy className="w-3 h-3 text-neutral-500" />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Password:</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        generatedFtpPassword || '123456',
                        'Password FTP',
                      )
                    }
                    className="text-neutral-200 hover:text-white flex items-center gap-1"
                  >
                    <span>{generatedFtpPassword || '123456'}</span>
                    <Copy className="w-3 h-3 text-neutral-500" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tombol Simulasi Jepret Kamera Fotografer */}
            <button
              type="button"
              disabled={simulatingShot}
              onClick={async () => {
                setSimulatingShot(true);
                try {
                  let handled = false;
                  try {
                    const res = await fetch(
                      `http://localhost:3001/v1/bridge-test-shot/${encodeURIComponent(selectedEvent.slug)}`,
                      { method: 'POST' },
                    );
                    if (res.ok) {
                      showToast(
                        'Jepretan uji coba berhasil dikirim dari Bridge Server lokal.',
                      );
                      handled = true;
                    }
                  } catch {
                    // Local bridge server offline or blocked by browser HTTPS Mixed Content
                  }

                  if (!handled) {
                    // Cloud / standalone: create crisp simulated camera shot and push to Live Wall & Gallery
                    const testFile = await createSimulatedTestShotFile(
                      selectedEvent.slug,
                    );
                    await processSinglePhotographerFile(testFile);
                    showToast(
                      'Bidikan kamera berhasil dikirim ke Live Wall & Galeri! 📸',
                    );
                  }
                } catch (err) {
                  showToast(
                    (err as Error).message ||
                      'Gagal menjalankan simulasi kamera.',
                  );
                } finally {
                  setSimulatingShot(false);
                }
              }}
              className="w-full py-2.5 px-4 rounded-md bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>
                {simulatingShot
                  ? 'Mengirim Jepretan...'
                  : 'Uji Kirim Bidikan Kamera'}
              </span>
            </button>

            {/* Mode Stasiun Tablet / Unggah Cepat dari SD Card / Galeri */}
            <div className="pt-3 border-t border-white/[0.07] space-y-2">
              <label className="w-full py-2.5 px-3.5 rounded-md bg-[#181816] hover:bg-[#20201D] active:scale-[0.99] border border-amber-500/30 text-amber-100 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>
                  {uploadingMainPhotos
                    ? 'Mengunggah Foto Kamera...'
                    : 'Unggah Foto Kamera (Mode Tablet / SD Card)'}
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingMainPhotos}
                  onChange={(e) => {
                    void handleMainCameraFilesUpload(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
              <p className="text-[10px] text-neutral-400 text-center">
                Pilih banyak foto langsung dari galeri iPad / Android atau kartu memori kamera.
              </p>

              {/* Opsi Tambahan untuk Tethering Kabel Laptop jika dibutuhkan */}
              <button
                type="button"
                onClick={() => setShowFtpAdvanced((prev) => !prev)}
                className="w-full flex items-center justify-between text-[11px] font-medium text-neutral-500 hover:text-neutral-300 py-1"
              >
                <span>Opsi Lanjutan Kabel USB Laptop</span>
                {showFtpAdvanced ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showFtpAdvanced && (
                <div className="mt-2 space-y-2.5 pt-2 border-t border-white/[0.05]">
                  {bridgeStatus?.hot_folder && (
                    <div className="p-3 rounded bg-[#0B0B0A] border border-white/[0.07] space-y-1.5 text-xs">
                      <div className="font-medium text-neutral-300 text-[11px]">
                        Hot-Folder USB Tethering Laptop
                      </div>
                      <p className="text-[10px] text-neutral-500 leading-relaxed">
                        Arahkan folder simpan Canon EOS Utility / Sony Remote ke:
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(bridgeStatus.hot_folder, 'Lokasi Hot-Folder')
                        }
                        className="w-full text-left p-1.5 rounded bg-[#141413] border border-white/[0.07] font-mono text-[9px] text-neutral-400 hover:border-white/20 flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{bridgeStatus.hot_folder}</span>
                        <Copy className="w-3 h-3 shrink-0 text-neutral-500" />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleToggleFolderSync()}
                    className="w-full py-2 px-3 rounded-md text-xs font-medium bg-[#0B0B0A] hover:bg-[#181816] border border-white/[0.07] text-neutral-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FolderSync className="w-3.5 h-3.5 text-neutral-400" />
                    <span>
                      {watchedFolderName
                        ? `Hentikan Sinkronisasi "${watchedFolderName}"`
                        : 'Sinkronisasi Folder Komputer'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. Custom Header Photo & Editable Text Settings */}
          <div className="p-5 rounded-lg bg-[#121211] border border-white/[0.07] space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                Sampul &amp; Judul Galeri
              </span>
            </div>

            {/* Live Darkened Header Preview */}
            <div
              className="relative h-28 rounded-md overflow-hidden border border-white/[0.08] flex flex-col items-center justify-center text-center px-3"
              style={{
                background: `linear-gradient(145deg, ${selectedEvent.theme_color} 0%, #14120E 100%)`,
              }}
            >
              {currentHeaderImage && (
                <>
                  <img
                    src={currentHeaderImage}
                    alt="Header preview"
                    className="absolute inset-0 w-full h-full object-cover brightness-[0.38] contrast-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-neutral-950/90" />
                </>
              )}
              {editHeaderSubtitle.trim() && (
                <span className="relative z-10 font-display italic text-xs tracking-[0.1em] text-white/85">
                  {editHeaderSubtitle}
                </span>
              )}
              <span className="relative z-10 font-display text-xl font-medium text-white drop-shadow-md truncate max-w-full">
                {(editEventName || selectedEvent.name).replace(
                  /^(pernikahan|the wedding of|resepsi|engagement of)\s+/i,
                  '',
                )}
              </span>
            </div>

            {/* Editable Header Subtitle & Couple/Event Name */}
            <div className="space-y-2.5 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Subjudul Pembuka
                </label>
                <input
                  type="text"
                  placeholder="Contoh: The Wedding of"
                  value={editHeaderSubtitle}
                  onChange={(e) => setEditHeaderSubtitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.08] text-xs text-[#F5F4F0]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-400 mb-1">
                  Nama Acara / Mempelai
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Budi & Ani"
                  value={editEventName}
                  onChange={(e) => setEditEventName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.08] text-xs text-[#F5F4F0]"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveHeaderTexts}
                className="w-full py-2 px-3 rounded-md bg-[#1A1A18] hover:bg-[#242422] border border-white/[0.08] text-[#F5F4F0] text-xs font-medium transition-colors"
              >
                Simpan Teks Sampul
              </button>
            </div>

            <div className="flex gap-2 pt-1">
              <label className="flex-1 py-2 px-3 rounded-md bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Ubah Foto Sampul</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    handleHeaderPhotoChange(e.target.files?.[0] || null)
                  }
                  className="hidden"
                />
              </label>

              {currentHeaderImage && (
                <button
                  type="button"
                  onClick={() => {
                    saveLocalEventCustomization(selectedEvent.slug, {
                      header_image_url: null,
                    });
                    onEventUpdated({
                      ...selectedEvent,
                      header_image_url: null,
                    });
                    showToast('Foto sampul dihapus.');
                  }}
                  className="px-3 py-2 rounded-md bg-[#1A1A18] hover:bg-[#242422] border border-white/[0.08] text-neutral-300 text-xs font-medium"
                  title="Hapus Foto Sampul"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* 3. Custom Digital Frame (.PNG) */}
          <div className="p-5 rounded-lg bg-[#121211] border border-white/[0.07] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                  Bingkai Digital (.PNG)
                </span>
                {currentFrameImage ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Aktif
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/[0.05] text-neutral-400 border border-white/[0.08]">
                    Belum Ada
                  </span>
                )}
              </div>

              {currentFrameImage && (
                <button
                  type="button"
                  onClick={handleRemoveFrame}
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors"
                >
                  Hapus Bingkai
                </button>
              )}
            </div>

            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#181816] border border-white/[0.06] text-xs">
              <button
                type="button"
                onClick={() => setFrameTab('default_polaroid')}
                className={`py-2 px-3 rounded-md font-medium text-center transition-all flex items-center justify-center gap-1.5 ${
                  frameTab === 'default_polaroid'
                    ? 'bg-[#292926] text-white shadow-xs border border-white/10'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Polaroid Default</span>
              </button>
              <button
                type="button"
                onClick={() => setFrameTab('custom_upload')}
                className={`py-2 px-3 rounded-md font-medium text-center transition-all flex items-center justify-center gap-1.5 ${
                  frameTab === 'custom_upload'
                    ? 'bg-[#292926] text-white shadow-xs border border-white/10'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Custom .PNG</span>
              </button>
            </div>

            {/* TAB 1: POLAROID DEFAULT */}
            {frameTab === 'default_polaroid' && (
              <div className="space-y-4">
                {/* Live Mockup Preview */}
                <div className="flex flex-col items-center justify-center py-5 px-3 bg-[#0A0A09] rounded-lg border border-white/[0.08]">
                  <div className="w-[190px] sm:w-[210px] bg-[#FFFFFF] rounded-xs shadow-[0_12px_32px_rgba(0,0,0,0.6)] p-2.5 pb-3.5 border border-neutral-300 select-none">
                    {/* Photo Window */}
                    <div className="relative aspect-[3/3.6] w-full bg-neutral-900 rounded-[1px] overflow-hidden border border-black/10">
                      <img
                        src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80"
                        alt="Foto Contoh"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Bottom Chin with cursive couple name and clean date */}
                    <div className="pt-3 pb-1 text-center space-y-0.5">
                      <div
                        className="text-2xl text-neutral-900 leading-tight italic truncate px-1"
                        style={{ fontFamily: "'Alex Brush', 'Dancing Script', 'Great Vibes', cursive" }}
                      >
                        {polaroidName.trim() || 'Nama Pasangan'}
                      </div>
                      <div className="text-[11px] font-semibold text-neutral-700 tracking-wider">
                        {polaroidDate.trim() || '26/06/2026'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-500 mt-2.5 text-center">
                    Pratinjau langsung tema Polaroid dengan teks kustom Anda
                  </span>
                </div>

                {/* Editable Inputs for Name & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-neutral-400">
                      Nama Pasangan / Acara
                    </label>
                    <input
                      type="text"
                      value={polaroidName}
                      onChange={(e) => setPolaroidName(e.target.value)}
                      placeholder="Contoh: Olivia & Mario"
                      className="w-full px-3 py-2 text-xs bg-[#1A1A18] border border-white/[0.08] rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-neutral-400">
                      Tanggal Acara
                    </label>
                    <input
                      type="text"
                      value={polaroidDate}
                      onChange={(e) => setPolaroidDate(e.target.value)}
                      placeholder="Contoh: 26/06/2026"
                      className="w-full px-3 py-2 text-xs bg-[#1A1A18] border border-white/[0.08] rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400/40"
                    />
                  </div>
                </div>

                {/* Apply Polaroid Button */}
                <button
                  type="button"
                  disabled={generatingPolaroid || uploadingFrame}
                  onClick={handleApplyDefaultPolaroid}
                  className="w-full py-2.5 px-4 rounded-md bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {generatingPolaroid || uploadingFrame ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sedang Merender &amp; Memasang Bingkai...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Terapkan Bingkai Polaroid Ini</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TAB 2: UPLOAD CUSTOM .PNG */}
            {frameTab === 'custom_upload' && (
              <div className="space-y-3">
                {currentFrameImage ? (
                  <div className="relative h-44 rounded-md overflow-hidden border border-white/[0.08] bg-[#0A0A09] flex items-center justify-center">
                    <img
                      src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80"
                      alt="Foto Contoh"
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                    />
                    <img
                      src={currentFrameImage}
                      alt="Bingkai Acara"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
                    />
                    <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded bg-black/75 backdrop-blur-xs text-[10px] text-neutral-300 text-center z-20">
                      Pratinjau Bingkai .PNG di atas Foto
                    </div>
                  </div>
                ) : (
                  <div className="h-32 rounded-md border border-dashed border-white/15 bg-[#0B0B0A] flex flex-col items-center justify-center p-4 text-center">
                    <Upload className="w-5 h-5 text-neutral-500 mb-1.5" />
                    <span className="text-xs font-medium text-neutral-300">
                      Pilih File Bingkai Transparan (.PNG)
                    </span>
                    <span className="text-[11px] text-neutral-500 max-w-xs mt-0.5 leading-relaxed">
                      Unggah file .PNG transparan buatan Anda (misal dari Canva/Photoshop) untuk ditempelkan pada setiap bidikan.
                    </span>
                  </div>
                )}

                <label className="w-full py-2.5 px-4 rounded-md bg-[#1A1A18] hover:bg-[#242422] border border-white/[0.08] text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-neutral-400" />
                  <span>
                    {uploadingFrame
                      ? 'Mengunggah...'
                      : currentFrameImage
                        ? 'Ganti File Bingkai (.PNG)'
                        : 'Pilih File Bingkai (.PNG)'}
                  </span>
                  <input
                    type="file"
                    accept="image/png"
                    disabled={uploadingFrame}
                    onChange={(e) => {
                      handleFrameFileChange(e.target.files?.[0] || null);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 3. Universal QR Code Card */}
          <div className="p-5 rounded-lg bg-[#121211] border border-white/[0.07] flex flex-col items-center text-center space-y-3">
            <div
              ref={qrCanvasRef}
              className="p-3 bg-white rounded-md"
            >
              <QRCodeCanvas
                value={`${originUrl.replace(/\/+$/, '')}/${selectedEvent.slug}?limit=${selectedEvent.guest_upload_limit}`}
                size={148}
                level="H"
              />
            </div>
            <div className="text-xs text-neutral-400 font-mono break-all">
              {originUrl.replace(/\/+$/, '')}/{selectedEvent.slug}
            </div>
            <button
              type="button"
              onClick={() => downloadQrCodePng(selectedEvent.slug)}
              className="w-full py-2 px-4 rounded-md text-xs font-medium bg-[#1A1A18] hover:bg-[#242422] border border-white/[0.08] text-[#F5F4F0] flex items-center justify-center gap-2 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5 text-neutral-400" />
              <span>Unduh QR Code (.PNG)</span>
            </button>
          </div>

          {/* 4. End Event & Archive ZIP Generator */}
          <div className="p-5 rounded-lg bg-[#121211] border border-white/[0.07] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                Arsip Akhir (.ZIP)
              </span>
              <span className="text-[11px] font-mono text-neutral-400 uppercase">
                {selectedEvent.archive_status}
              </span>
            </div>

            {selectedEvent.status === 'active' ? (
              <button
                type="button"
                onClick={handleEndEventAndGenerateZip}
                className="w-full py-2.5 px-4 rounded-md text-xs font-medium bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/30 text-rose-200 flex items-center justify-center gap-2 transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Akhiri Acara &amp; Buat ZIP</span>
              </button>
            ) : (
              <div className="space-y-2.5">
                {selectedEvent.archive_status === 'ready' &&
                  selectedEvent.archive_download_url ? (
                  <a
                    href={selectedEvent.archive_download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-md text-xs font-medium bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Semua Foto (.ZIP)</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => triggerAdminArchive(selectedEvent.id)}
                    className="w-full py-2 px-4 rounded-md text-xs font-medium bg-[#1A1A18] hover:bg-[#242422] border border-white/[0.08] text-neutral-200 flex items-center justify-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Proses Ulang ZIP</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (8 cols): Live Gallery & Moderation Queue */}
        <div className="lg:col-span-8 p-5 rounded-lg bg-[#121211] border border-white/[0.07] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
            <div className="inline-flex p-0.5 rounded-md bg-[#0B0B0A] border border-white/[0.07]">
              <button
                type="button"
                onClick={() => setControlTab('gallery')}
                className={`px-3.5 py-1.5 rounded text-xs transition-colors ${controlTab === 'gallery'
                    ? 'bg-white/[0.1] text-[#F5F4F0] font-medium'
                    : 'text-neutral-400 hover:text-neutral-200'
                  }`}
              >
                Galeri Tayang ({approvedPhotos.length})
              </button>

              <button
                type="button"
                onClick={() => setControlTab('moderation')}
                className={`px-3.5 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 ${controlTab === 'moderation'
                    ? 'bg-white/[0.1] text-[#F5F4F0] font-medium'
                    : 'text-neutral-400 hover:text-neutral-200'
                  }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Antrean Moderasi ({pendingPhotos.length})</span>
              </button>
            </div>

            {controlTab === 'gallery' && (
              <select
                value={gallerySourceFilter}
                onChange={(e) =>
                  setGallerySourceFilter(e.target.value as 'all' | PhotoSource)
                }
                className="px-3 py-1.5 rounded-md bg-[#0B0B0A] border border-white/[0.08] text-xs text-neutral-200 focus:outline-none"
              >
                <option value="all">Semua Sumber</option>
                <option value="photographer">Kamera Utama</option>
                <option value="guest">Kamera Tamu</option>
              </select>
            )}
          </div>

          {/* Tab 1: Live Gallery with Force Delete */}
          {controlTab === 'gallery' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {approvedPhotos.length === 0 ? (
                <div className="col-span-full py-20 text-center text-xs text-neutral-500">
                  Belum ada foto pada filter ini.
                </div>
              ) : (
                approvedPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className={`group relative rounded-md overflow-hidden border border-white/[0.07] ${
                      currentFrameImage ? 'aspect-[5/7] bg-white' : 'aspect-[4/3] bg-[#0B0B0A]'
                    }`}
                  >
                    {currentFrameImage ? (
                      <>
                        <div className="absolute left-[4.8%] right-[4.8%] top-[3.43%] h-[74.28%] overflow-hidden bg-neutral-900 rounded-[1px]">
                          <img
                            src={photo.url}
                            alt="Event photo"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <img
                          src={currentFrameImage}
                          alt="Bingkai Digital"
                          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-10"
                        />
                      </>
                    ) : (
                      <img
                        src={photo.url}
                        alt="Event photo"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between z-20">
                      <span className="text-[11px] font-medium text-neutral-200 truncate">
                        {photo.source === 'photographer'
                          ? 'Kamera Utama'
                          : photo.guest_name || 'Tamu'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleForceDeletePhoto(photo.id)}
                        title="Hapus Foto"
                        className="p-1.5 rounded bg-black/70 hover:bg-rose-600 text-neutral-300 hover:text-white transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Guest Moderation Queue (Approve / Reject) */}
          {controlTab === 'moderation' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {pendingPhotos.length === 0 ? (
                <div className="col-span-full py-20 text-center text-xs text-neutral-500">
                  Tidak ada antrean foto yang menunggu persetujuan.
                </div>
              ) : (
                pendingPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="rounded-md overflow-hidden bg-[#0B0B0A] border border-white/[0.1] flex flex-col"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-black">
                      <img
                        src={photo.url}
                        alt="Pending guest photo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3 space-y-2.5">
                      <div className="text-xs font-medium text-[#F5F4F0] truncate">
                        {photo.guest_name || 'Tamu'}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleModeratePhoto(photo.id, 'approved')
                          }
                          className="py-1.5 rounded bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] font-medium text-xs flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Setujui</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleModeratePhoto(photo.id, 'rejected')
                          }
                          className="py-1.5 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/30 text-rose-200 font-medium text-xs flex items-center justify-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Tolak</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

