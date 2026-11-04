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
  Pencil,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
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
  uploadAdminHeaderImage,
} from '@/lib/admin-api';
import {
  addLocalEventPhoto,
  confirmGuestPhotoUpload,
  getLocalEventCustomization,
  getLocalEventPhotos,
  removeLocalEventPhoto,
  requestGuestPresignedUrl,
  saveLocalEventCustomization,
  subscribeLocalLiveEvents,
  uploadFileToPresignedUrl,
} from '@/lib/api';
import { createEventSocket } from '@/lib/socket';
import { AdminEvent, PhotoItem, PhotoSource } from '@/lib/types';
import {
  DEMO_ADMIN_PHOTOS,
  getStoredDemoEvents,
  saveStoredDemoEvents,
} from './demo-data';

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
    setEditHeaderSubtitle(
      localCustom?.header_subtitle !== undefined
        ? (localCustom.header_subtitle ?? '')
        : (selectedEvent.header_subtitle ?? 'The Wedding of'),
    );

    async function loadControlRoomPhotos() {
      const localPhotos = getLocalEventPhotos(selectedEvent.slug);
      if (isDemoMode) {
        setEventPhotos([...localPhotos, ...DEMO_ADMIN_PHOTOS]);
        return;
      }
      const list = await fetchAdminEventPhotos(selectedEvent.id);
      setEventPhotos([...localPhotos, ...list]);
    }

    async function loadBridgeStatus() {
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

  const processSinglePhotographerFile = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        const maxDim = 1600;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        } else {
          resolve(objUrl);
        }
        URL.revokeObjectURL(objUrl);
      };
      img.onerror = reject;
      img.src = objUrl;
    });

    const newPhoto: PhotoItem = {
      id: `main-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: dataUrl,
      source: 'photographer',
      guest_name: null,
      status: 'approved',
      created_at: new Date().toISOString(),
    };

    addLocalEventPhoto(selectedEvent.slug, newPhoto);
    setEventPhotos((prev) => [newPhoto, ...prev]);

    if (!isDemoMode) {
      try {
        const presigned = await requestGuestPresignedUrl(selectedEvent.slug, {
          filename: file.name,
          content_type: file.type || 'image/jpeg',
          guest_identifier: `admin_photographer_${Date.now()}`,
          source: 'photographer',
        });
        await uploadFileToPresignedUrl(presigned.upload_url, file);
        await confirmGuestPhotoUpload(selectedEvent.slug, {
          file_key: presigned.file_key,
          guest_identifier: `admin_photographer_${Date.now()}`,
        });
      } catch {
        // Kept in local live gallery & BroadcastChannel if R2 is offline
      }
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
        await deleteAdminPhoto(selectedEvent.id, photoId).catch(() => {});
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
              className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                selectedEvent.status === 'active'
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
                    onClick={() =>
                      copyText(
                        bridgeStatus?.local_ip || '127.0.0.1',
                        'IP Server FTP',
                      )
                    }
                    className="text-neutral-200 hover:text-white flex items-center gap-1"
                  >
                    <span>{bridgeStatus?.local_ip || '127.0.0.1'}</span>
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

            {/* Opsi 2: Kabel USB Kamera (Hot-Folder Otomatis) */}
            {bridgeStatus?.hot_folder && (
              <div className="p-3.5 rounded-md bg-[#0B0B0A] border border-white/[0.07] space-y-2 text-xs">
                <div className="font-medium text-neutral-200">
                  2. Kabel USB Kamera (Hot-Folder)
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Arahkan lokasi simpan EOS Utility / Sony Remote ke folder ini:
                </p>
                <button
                  type="button"
                  onClick={() =>
                    copyText(bridgeStatus.hot_folder, 'Lokasi Hot-Folder')
                  }
                  className="w-full text-left p-2 rounded bg-[#141413] border border-white/[0.07] font-mono text-[10px] text-neutral-300 hover:border-white/20 flex items-center justify-between gap-2"
                >
                  <span className="truncate">{bridgeStatus.hot_folder}</span>
                  <Copy className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
                </button>
              </div>
            )}

            {/* Tombol Simulasi Jepret Kamera Fotografer */}
            <button
              type="button"
              disabled={simulatingShot}
              onClick={async () => {
                setSimulatingShot(true);
                try {
                  const res = await fetch(
                    `http://localhost:3001/v1/bridge-test-shot/${encodeURIComponent(selectedEvent.slug)}`,
                    { method: 'POST' },
                  );
                  if (res.ok) {
                    showToast(
                      'Jepretan uji coba berhasil dikirim ke layar.',
                    );
                  } else {
                    showToast('Gagal menjalankan simulasi kamera.');
                  }
                } catch {
                  showToast('Server Bridge lokal belum aktif.');
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

              {/* Opsi Tambahan untuk Sinkronisasi Folder Laptop jika digunakan */}
              <button
                type="button"
                onClick={() => setShowFtpAdvanced((prev) => !prev)}
                className="w-full flex items-center justify-between text-[11px] font-medium text-neutral-400 hover:text-white py-1"
              >
                <span>Opsi Lanjutan Sinkronisasi Folder</span>
                {showFtpAdvanced ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showFtpAdvanced && (
                <div className="mt-2 space-y-2">
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
                className={`px-3.5 py-1.5 rounded text-xs transition-colors ${
                  controlTab === 'gallery'
                    ? 'bg-white/[0.1] text-[#F5F4F0] font-medium'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Galeri Tayang ({approvedPhotos.length})
              </button>

              <button
                type="button"
                onClick={() => setControlTab('moderation')}
                className={`px-3.5 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 ${
                  controlTab === 'moderation'
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
                    className="group relative rounded-md overflow-hidden bg-[#0B0B0A] border border-white/[0.07] aspect-[4/3]"
                  >
                    <img
                      src={photo.url}
                      alt="Event photo"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between">
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

