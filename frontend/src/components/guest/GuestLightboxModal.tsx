'use client';

import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { PhotoItem } from '@/lib/types';

interface GuestLightboxModalProps {
  photo: PhotoItem;
  currentIndex: number;
  totalPhotos: number;
  headline: string;
  themeColor: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDownload: (photo: PhotoItem) => void;
}

export default function GuestLightboxModal({
  photo,
  currentIndex,
  totalPhotos,
  headline,
  themeColor,
  onClose,
  onPrev,
  onNext,
  onDownload,
}: GuestLightboxModalProps) {
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onPrev, onNext, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between select-none"
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartXRef.current === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
        if (deltaX > 50) onPrev();
        if (deltaX < -50) onNext();
        touchStartXRef.current = null;
      }}
    >
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10">
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate">{headline}</p>
          <p className="text-[11px] text-neutral-400">
            {photo.source === 'guest' && photo.guest_name
              ? `Potret oleh ${photo.guest_name}`
              : `Foto ${currentIndex + 1} dari ${totalPhotos}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center px-3 overflow-hidden">
        {totalPhotos > 1 && (
          <button
            type="button"
            onClick={onPrev}
            className="absolute left-3 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/15"
            aria-label="Foto sebelumnya"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <img
          src={photo.url}
          alt="Pratinjau foto"
          className="max-h-[74vh] max-w-full object-contain rounded-xl shadow-2xl"
        />

        {totalPhotos > 1 && (
          <button
            type="button"
            onClick={onNext}
            className="absolute right-3 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/15"
            aria-label="Foto berikutnya"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-4 border-t border-white/10 bg-neutral-950/90">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={() => onDownload(photo)}
            className="w-full py-3.5 px-6 rounded-2xl font-extrabold text-sm text-neutral-950 flex items-center justify-center gap-2 shadow-xl active:scale-[0.99] transition"
            style={{ backgroundColor: themeColor }}
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Simpan ke Perangkat</span>
          </button>
        </div>
      </div>
    </div>
  );
}

