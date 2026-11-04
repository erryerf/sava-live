'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      {!isCameraActive ? (
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
      ) : (
        <form
          onSubmit={onSubmitUpload}
          className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-2xl max-h-[94vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span
                className="text-[11px] font-bold uppercase tracking-wider block truncate"
                style={{ color: themeColor }}
              >
                {guestNameInput.trim()} • Kamera Langsung
              </span>
              <h3 className="text-base font-extrabold text-white">
                Abadikan Momen Acara
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
                {capturedQueue.length} / {remainingQuota} Foto
              </span>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={uploading}
                className="p-1.5 rounded-full text-neutral-400 hover:text-white disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

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
                    <span>Hubungkan Ulang</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenFilePicker}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/15"
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

                {capturedQueue.length >= remainingQuota && (
                  <div className="absolute inset-x-3 bottom-3 px-3.5 py-2 rounded-xl bg-black/80 backdrop-blur-md border border-amber-400/40 text-center">
                    <p className="text-xs font-bold text-amber-300">
                      Batas kuota ({remainingQuota} foto) telah tercapai.
                      Silakan unggah koleksi di bawah atau hapus foto untuk
                      mengambil ulang.
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
                  <span>Ganti Kamera</span>
                </button>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span>
                {capturedQueue.length === 0
                  ? 'Ketuk Ambil Foto di bawah untuk mulai memotret'
                  : `Koleksi siap diunggah (${capturedQueue.length} foto)`}
              </span>
              {capturedQueue.length > 0 && (
                <span className="text-neutral-300 font-semibold">
                  Sisa kuota:{' '}
                  {Math.max(0, remainingQuota - capturedQueue.length)}
                </span>
              )}
            </div>

            {capturedQueue.length > 0 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5">
                {capturedQueue.map((shot, idx) => (
                  <div
                    key={shot.id}
                    className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/20 bg-neutral-950 shrink-0"
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
            )}
          </div>

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
                onClick={handleCapturePhoto}
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
                    ? 'Kuota Terpenuhi'
                    : capturedQueue.length > 0
                      ? 'Ambil Lagi'
                      : 'Ambil Foto'}
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
                  <span>Mengunggah...</span>
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
        </form>
      )}
    </div>
  );
}
