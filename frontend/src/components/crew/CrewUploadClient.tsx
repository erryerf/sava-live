'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  Loader2,
  RefreshCw,
  Smartphone,
  Sparkles,
  Wifi,
  XCircle,
} from 'lucide-react';
import {
  addLocalEventPhoto,
  fetchPublicEvent,
  uploadPhotoDirectly,
} from '@/lib/api';
import { compressImageUnder2MB } from '@/lib/image-compress';
import { PublicEvent } from '@/lib/types';

interface CrewUploadClientProps {
  slug: string;
}

type QueueStatus = 'queued' | 'compressing' | 'uploading' | 'done' | 'error';

interface CrewQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  status: QueueStatus;
  errorMsg?: string;
}

export default function CrewUploadClient({ slug }: CrewUploadClientProps) {
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [queue, setQueue] = useState<CrewQueueItem[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [activeGuide, setActiveGuide] = useState<'canon' | 'sony' | 'nikon' | 'fuji'>('canon');

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    fetchPublicEvent(slug)
      .then((evt) => {
        if (mounted) {
          setEvent(evt);
          setLoadingEvent(false);
        }
      })
      .catch(() => {
        if (mounted) setLoadingEvent(false);
      });
    return () => {
      mounted = false;
    };
  }, [slug]);

  const updateQueueItem = (
    id: string,
    patch: Partial<CrewQueueItem>,
  ) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const processSingleItem = async (item: CrewQueueItem) => {
    try {
      updateQueueItem(item.id, { status: 'compressing', errorMsg: undefined });
      const optimizedFile = await compressImageUnder2MB(item.file);

      updateQueueItem(item.id, { status: 'uploading' });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsDataURL(optimizedFile);
      });

      const confirmed = await uploadPhotoDirectly(slug, {
        file_data: dataUrl,
        guest_identifier: `crew_mobile_${slug}`,
        source: 'photographer',
      });

      if (confirmed?.data) {
        addLocalEventPhoto(slug, confirmed.data);
      }

      updateQueueItem(item.id, { status: 'done' });
      setUploadedCount((c) => c + 1);
    } catch (err) {
      updateQueueItem(item.id, {
        status: 'error',
        errorMsg: (err as Error).message || 'Gagal unggah',
      });
    }
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const newItems: CrewQueueItem[] = files.map((file) => ({
      id: `crew-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'queued',
    }));

    setQueue((prev) => [...newItems, ...prev]);

    // Upload concurrently in small batches of 3 for fast mobile throughput
    const runBatch = async () => {
      const concurrency = 3;
      let idx = 0;
      const worker = async () => {
        while (idx < newItems.length) {
          const current = newItems[idx++];
          if (current) {
            await processSingleItem(current);
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(concurrency, newItems.length) }, () =>
          worker(),
        ),
      );
    };

    void runBatch();
  };

  const handleRetryFailed = () => {
    const failedItems = queue.filter((q) => q.status === 'error');
    for (const item of failedItems) {
      void processSingleItem(item);
    }
  };

  if (loadingEvent) {
    return (
      <div className="min-h-screen bg-[#0B0B0A] text-white flex items-center justify-center p-6">
        <div className="flex items-center gap-2.5 text-sm text-neutral-400">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          <span>Memuat stasiun kru...</span>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[#0B0B0A] text-white flex flex-col items-center justify-center p-6 text-center space-y-3">
        <XCircle className="w-10 h-10 text-rose-400" />
        <h1 className="text-lg font-semibold">Acara Tidak Ditemukan</h1>
        <p className="text-xs text-neutral-400 max-w-xs">
          Pastikan link kru untuk slug &ldquo;{slug}&rdquo; sudah benar atau acara masih aktif.
        </p>
      </div>
    );
  }

  const themeColor = event.theme_color || '#D4AF37';
  const failedCount = queue.filter((q) => q.status === 'error').length;
  const activeCount = queue.filter(
    (q) => q.status === 'queued' || q.status === 'compressing' || q.status === 'uploading',
  ).length;

  return (
    <div className="min-h-screen bg-[#0B0B0A] text-[#F5F4F0] pb-16">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0B0B0A]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3.5">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-neutral-950"
                style={{ backgroundColor: themeColor }}
              >
                Mode Kru
              </span>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Unlimited
              </span>
            </div>
            <h1 className="text-sm font-semibold truncate mt-1">
              {event.name}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/live/${slug}`}
              target="_blank"
              className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-[11px] font-medium flex items-center gap-1 text-neutral-200"
            >
              <span>Live Wall</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-5 space-y-5">
        {/* Upload Action Card */}
        <section className="p-5 rounded-2xl bg-[#141412] border border-white/[0.08] space-y-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">
                Unggah Cepat Kamera Utama
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                Foto langsung tayang ke Live Wall &amp; tab Kamera Utama tanpa batas kuota tamu.
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl font-bold text-white">{uploadedCount}</div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                Tayang
              </div>
            </div>
          </div>

          <input
            ref={galleryInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-neutral-950 flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
              style={{ backgroundColor: themeColor }}
            >
              <ImagePlus className="w-4 h-4 stroke-[2.4]" />
              <span>Pilih Banyak dari Galeri</span>
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>Jepret Langsung HP</span>
            </button>
          </div>

          {(activeCount > 0 || failedCount > 0) && (
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
              <span className="text-neutral-400">
                {activeCount > 0
                  ? `Sedang memproses ${activeCount} foto...`
                  : `${failedCount} foto gagal terkirim`}
              </span>
              {failedCount > 0 && (
                <button
                  type="button"
                  onClick={handleRetryFailed}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-medium flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Ulangi Gagal</span>
                </button>
              )}
            </div>
          )}
        </section>

        {/* Queue Status Grid */}
        {queue.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Antrean Pengiriman ({queue.length})
              </span>
              <button
                type="button"
                onClick={() =>
                  setQueue((prev) => prev.filter((q) => q.status !== 'done'))
                }
                className="text-[11px] text-neutral-500 hover:text-neutral-300"
              >
                Bersihkan Selesai
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-square rounded-xl overflow-hidden bg-neutral-900 border border-white/[0.08]"
                >
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center p-1.5 text-center">
                    {item.status === 'done' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 drop-shadow" />
                    ) : item.status === 'error' ? (
                      <button
                        type="button"
                        onClick={() => void processSingleItem(item)}
                        className="flex flex-col items-center gap-1 text-rose-300"
                      >
                        <RefreshCw className="w-5 h-5" />
                        <span className="text-[10px] font-bold">Ulangi</span>
                      </button>
                    ) : (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
                        <span className="text-[10px] font-medium text-white mt-1">
                          {item.status === 'compressing' ? 'Kompres...' : 'Kirim...'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick Camera Wi-Fi Pairing Guide for Photographers */}
        <section className="p-4 rounded-2xl bg-[#121210] border border-white/[0.07] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
            <Wifi className="w-4 h-4 text-amber-400" />
            <span>Tips Pairing Kamera Wi-Fi ke HP Ini</span>
          </div>

          <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[#0B0B0A] border border-white/[0.05] text-[11px]">
            {(
              [
                { id: 'canon', label: 'Canon' },
                { id: 'sony', label: 'Sony' },
                { id: 'nikon', label: 'Nikon' },
                { id: 'fuji', label: 'Fuji' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveGuide(tab.id)}
                className={`py-1.5 rounded-md font-medium transition-colors ${
                  activeGuide === tab.id
                    ? 'bg-white/[0.12] text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-neutral-400 leading-relaxed space-y-1.5 px-1">
            {activeGuide === 'canon' && (
              <>
                <p className="text-neutral-200 font-medium flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                  Canon EOS RP / R / M50 (Canon Camera Connect)
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Hubungkan kamera ke HP via app <strong>Canon Camera Connect</strong>.</li>
                  <li>Aktifkan <strong>Auto Transfer / Send to smartphone after shot</strong>.</li>
                  <li>Pilih ukuran <strong>Medium / Small JPEG</strong> agar transfer super cepat.</li>
                  <li>Foto otomatis masuk galeri HP ➔ pilih di tombol kuning atas untuk tayang!</li>
                </ol>
              </>
            )}
            {activeGuide === 'sony' && (
              <>
                <p className="text-neutral-200 font-medium flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                  Sony Alpha (Creators&apos; App / Imaging Edge Mobile)
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Buka <strong>Creators&apos; App</strong> dan hubungkan kamera via Wi-Fi/Bluetooth.</li>
                  <li>Gunakan mode <strong>Transfer / Remote Shooting</strong> dengan size <strong>2M JPEG</strong>.</li>
                  <li>Foto yang tersimpan di galeri HP tinggal dipilih di atas untuk tayang.</li>
                </ol>
              </>
            )}
            {activeGuide === 'nikon' && (
              <>
                <p className="text-neutral-200 font-medium flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                  Nikon Z Series (Nikon SnapBridge)
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Pair kamera di aplikasi <strong>Nikon SnapBridge</strong>.</li>
                  <li>Aktifkan <strong>Auto Link &amp; Auto Download (2MP)</strong>.</li>
                  <li>Setiap jepretan langsung masuk galeri HP dan siap dikirim dari sini.</li>
                </ol>
              </>
            )}
            {activeGuide === 'fuji' && (
              <>
                <p className="text-neutral-200 font-medium flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                  Fujifilm X Series (FUJIFILM XApp)
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>Hubungkan kamera via <strong>FUJIFILM XApp</strong>.</li>
                  <li>Aktifkan <strong>Auto Image Transfer</strong> (3M resize) di pengaturan kamera.</li>
                  <li>Pilih foto dari galeri HP melalui tombol kuning di atas.</li>
                </ol>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

