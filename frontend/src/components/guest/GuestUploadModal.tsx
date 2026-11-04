'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { CapturedShot } from './guestGalleryConstants';

interface GuestUploadModalProps {
  themeColor: string;
  uploadLimit: number;
  remainingQuota: number;
  guestNameInput: string;
  onChangeGuestName: (value: string) => void;
  capturedQueue: CapturedShot[];
  onAddCapturedShot: (shot: CapturedShot) => void;
  onRemoveCapturedShot: (shotId: string) => void;
  onOpenFilePicker: () => void;
  uploading: boolean;
  onSubmitUpload: (e: React.FormEvent) => void;
  onClose: () => void;
  showToast: (text: string, type?: 'success' | 'info' | 'warning') => void;
}

export default function GuestUploadModal({
  themeColor,
  uploadLimit,
  remainingQuota,
  guestNameInput,
  onChangeGuestName,
  capturedQueue,
  onAddCapturedShot,
  onRemoveCapturedShot,
  onOpenFilePicker,
  uploading,
  onSubmitUpload,
  onClose,
  showToast,
}: GuestUploadModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(
    capturedQueue.length > 0,
  );
  const [cameraFacingMode, setCameraFacingMode] = useState<
    'environment' | 'user'
  >('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);

  const stopLiveCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startLiveCamera = useCallback(
    async (facing: 'environment' | 'user' = cameraFacingMode) => {
      if (!guestNameInput.trim()) {
        showToast('Mohon lengkapi nama Anda terlebih dahulu.', 'warning');
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraError(null);
      setIsCameraActive(true);

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCameraError(
          'Perangkat ini tidak mendukung akses kamera langsung. Silakan pilih foto dari galeri perangkat Anda.',
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
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
            'Akses kamera belum diizinkan atau sedang digunakan aplikasi lain. Izinkan akses kamera pada pengaturan browser Anda.',
          );
        }
      }
    },
    [cameraFacingMode, guestNameInput, showToast],
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

  const handleCapturePhoto = () => {
    if (capturedQueue.length >= remainingQuota) {
      showToast(
        `Kuota maksimum (${uploadLimit} foto) telah terpenuhi. Silakan unggah koleksi Anda.`,
        'warning',
      );
      return;
    }

    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

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
        const shotId = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const capturedFile = new File([blob], `${shotId}.jpg`, {
          type: 'image/jpeg',
        });
        const url = URL.createObjectURL(capturedFile);
        onAddCapturedShot({ id: shotId, file: capturedFile, previewUrl: url });
      },
      'image/jpeg',
      0.92,
    );
  };

  const handleCloseModal = () => {
    stopLiveCamera();
    onClose();
  };

  if (!isCameraActive) {
    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-3xl p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: themeColor }}
              >
                Langkah 1 dari 2
              </span>
              <h3 className="text-base font-extrabold text-white">
                Identitas Tamu
              </h3>
            </div>
            <button
              type="button"
              onClick={handleCloseModal}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed">
            Masukkan nama Anda untuk dicantumkan pada setiap foto yang Anda
            bagikan ke galeri acara.
          </p>

          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Nama Anda <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              autoFocus
              maxLength={60}
              placeholder="Contoh: Rangga / Nadia & Rekan"
              value={guestNameInput}
              onChange={(e) => onChangeGuestName(e.target.value)}
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
            Sisa kuota unggahan Anda: {remainingQuota} dari {uploadLimit} foto
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
              <span>Buka Kamera</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmitUpload}
      className="fixed inset-0 z-50 h-[100dvh] w-full bg-black overflow-hidden flex flex-col justify-between select-none"
    >
      {/* Full-Screen Live Camera Viewfinder */}
      <div className="absolute inset-0 z-0 bg-black flex items-center justify-center">
        {cameraError ? (
          <div className="p-6 max-w-sm text-center space-y-4 z-10">
            <p className="text-xs sm:text-sm text-amber-300 font-medium leading-relaxed">
              {cameraError}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => void startLiveCamera()}
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-extrabold text-neutral-950 flex items-center justify-center gap-1.5"
                style={{ backgroundColor: themeColor }}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Hubungkan Ulang</span>
              </button>
              <button
                type="button"
                onClick={onOpenFilePicker}
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-white/15"
              >
                Pilih dari Galeri
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

            {shutterFlash && (
              <div className="absolute inset-0 bg-white/80 pointer-events-none transition-opacity duration-150" />
            )}
          </>
        )}
      </div>

      {/* Top Floating HUD Bar */}
      <div className="relative z-20 flex items-center justify-between gap-2 px-4 pt-5 pb-8 bg-gradient-to-b from-black/85 via-black/45 to-transparent">
        <button
          type="button"
          disabled={uploading}
          onClick={stopLiveCamera}
          className="px-3.5 py-2 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 truncate max-w-[44%]"
        >
          <span>&larr;</span>
          <span className="truncate">{guestNameInput.trim()}</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-extrabold backdrop-blur-md border ${
              capturedQueue.length >= remainingQuota
                ? 'bg-amber-500/25 text-amber-200 border-amber-400/50'
                : 'bg-black/55 text-white border-white/20'
            }`}
          >
            {capturedQueue.length} / {remainingQuota} Foto
          </span>

          {!cameraError && (
            <button
              type="button"
              onClick={handleFlipCamera}
              disabled={uploading}
              aria-label="Ganti Kamera"
              className="px-3 py-1.5 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/20 text-xs font-bold text-white flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Ganti Kamera</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCloseModal}
            disabled={uploading}
            aria-label="Tutup kamera"
            className="p-2 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/20 text-white disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Floating Camera Dock (Filmstrip + Shutter + Submit) */}
      <div className="relative z-20 px-4 pb-8 pt-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent space-y-4">
        <div className="max-w-md mx-auto w-full space-y-3">
          {capturedQueue.length >= remainingQuota && (
            <div className="px-3.5 py-2 rounded-xl bg-black/80 backdrop-blur-md border border-amber-400/40 text-center">
              <p className="text-xs font-semibold text-amber-200">
                Batas kuota ({remainingQuota} foto) telah tercapai. Ketuk Unggah
                untuk mengirim atau hapus foto untuk mengambil ulang.
              </p>
            </div>
          )}

          {/* Horizontal Filmstrip Tray */}
          {capturedQueue.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-neutral-300 px-1">
                <span className="font-medium">
                  Koleksi siap diunggah ({capturedQueue.length} foto)
                </span>
                <span>
                  Sisa kuota:{' '}
                  {Math.max(0, remainingQuota - capturedQueue.length)}
                </span>
              </div>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5">
                {capturedQueue.map((shot, idx) => (
                  <div
                    key={shot.id}
                    className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-white/25 bg-neutral-950 shrink-0 shadow-lg"
                  >
                    <img
                      src={shot.previewUrl}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.2 rounded bg-black/75 text-[9px] font-bold text-white">
                      {idx + 1}
                    </span>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => onRemoveCapturedShot(shot.id)}
                      aria-label={`Hapus foto ${idx + 1}`}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 hover:bg-red-600 text-white flex items-center justify-center border border-white/20 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-white/80 font-medium drop-shadow">
              Ketuk tombol di bawah untuk mengambil foto
            </p>
          )}

          {/* Main Camera Controls Bar */}
          <div className="grid grid-cols-3 items-center gap-3 pt-1">
            {/* Left: Gallery / Flip */}
            <div className="flex justify-start">
              <button
                type="button"
                disabled={uploading || capturedQueue.length >= remainingQuota}
                onClick={onOpenFilePicker}
                className="px-3.5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-40 transition"
              >
                <ImagePlus className="w-4 h-4" />
                <span>Galeri</span>
              </button>
            </div>

            {/* Center: Full-Screen Tactile Shutter Button */}
            <div className="flex flex-col items-center justify-center">
              {!cameraError && (
                <button
                  type="button"
                  disabled={uploading || capturedQueue.length >= remainingQuota}
                  onClick={handleCapturePhoto}
                  aria-label="Ambil Foto"
                  className="group relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1.5 shadow-[0_0_30px_rgba(0,0,0,0.6)] active:scale-95 disabled:opacity-35 transition-transform"
                >
                  <span
                    className="w-full h-full rounded-full transition-transform group-active:scale-90 flex items-center justify-center"
                    style={{
                      backgroundColor:
                        capturedQueue.length >= remainingQuota
                          ? '#525252'
                          : '#FFFFFF',
                    }}
                  >
                    <Camera className="w-6 h-6 text-neutral-950 stroke-[2.2]" />
                  </span>
                </button>
              )}
              <span className="text-[11px] font-bold text-white/90 mt-1.5 tracking-wide">
                {capturedQueue.length >= remainingQuota
                  ? 'Kuota Terpenuhi'
                  : capturedQueue.length > 0
                    ? 'Ambil Lagi'
                    : 'Ambil Foto'}
              </span>
            </div>

            {/* Right: Submit / Unggah Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={uploading || capturedQueue.length === 0}
                className="px-4 py-3 rounded-full text-xs sm:text-sm font-extrabold text-neutral-950 flex items-center justify-center gap-1.5 shadow-xl disabled:opacity-30 active:scale-95 transition"
                style={{ backgroundColor: themeColor }}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengunggah</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      Unggah
                      {capturedQueue.length > 0
                        ? ` (${capturedQueue.length})`
                        : ''}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
