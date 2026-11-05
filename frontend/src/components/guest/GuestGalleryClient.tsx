'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Camera, Loader2, Plus, Search, Sparkles, Star, X } from 'lucide-react';
import { PhotoItem } from '@/lib/types';
import {
  CapturedShot,
  cleanCoupleHeadline,
  formatDemoEventTitle,
} from './guestGalleryConstants';
import GuestGalleryHeader from './GuestGalleryHeader';
import GuestLightboxModal from './GuestLightboxModal';
import GuestUploadModal from './GuestUploadModal';
import { useGuestGalleryData } from './useGuestGalleryData';

interface GuestGalleryClientProps {
  slug: string;
}

export default function GuestGalleryClient({ slug }: GuestGalleryClientProps) {
  const {
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
    isPhotoMine,
  } = useGuestGalleryData(slug);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [capturedQueue, setCapturedQueue] = useState<CapturedShot[]>([]);
  const [guestNameInput, setGuestNameInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('sava_saved_guest_name') || '';
  });
  const [uploading, setUploading] = useState(false);

  const currentPhotos =
    activeTab === 'guest' ? filteredGuestPhotos : photosByTab.photographer;
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
      showToast('Foto berhasil disimpan ke perangkat.', 'success');
    } catch {
      window.open(photo.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAddCapturedShot = (shot: CapturedShot) => {
    setCapturedQueue((prev) => {
      if (prev.length >= remainingQuota) {
        URL.revokeObjectURL(shot.previewUrl);
        return prev;
      }
      const next = [...prev, shot];
      if (next.length >= remainingQuota) {
        showToast(
          `Kuota maksimum (${uploadLimit} foto) telah tercapai. Silakan unggah koleksi Anda.`,
          'info',
        );
      }
      return next;
    });
  };

  const handleRemoveCapturedShot = (shotId: string) => {
    setCapturedQueue((prev) => {
      const target = prev.find((item) => item.id === shotId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== shotId);
    });
  };

  const handleFabClick = () => {
    if (usedQuota >= uploadLimit) {
      showToast(
        `Kuota unggahan Anda (${uploadLimit} foto) telah terpenuhi. Terima kasih atas partisipasi Anda.`,
        'warning',
      );
      return;
    }
    setCapturedQueue((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
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
    setIsUploadModalOpen(true);
    e.target.value = '';
  };

  const closeUploadModal = () => {
    setCapturedQueue((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setIsUploadModalOpen(false);
  };

  const handleConfirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (capturedQueue.length === 0 || uploading) return;
    if (!guestNameInput.trim()) {
      showToast('Mohon lengkapi nama Anda terlebih dahulu.', 'warning');
      return;
    }

    setUploading(true);
    try {
      await uploadGuestQueue(capturedQueue, guestNameInput);
      closeUploadModal();
    } catch (err) {
      showToast(
        (err as Error).message ||
          'Gagal mengunggah foto. Silakan coba kembali.',
        'warning',
      );
    } finally {
      setUploading(false);
    }
  };

  const isLight = event?.gallery_theme === 'light';

  if (loading) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center gap-3 ${
          isLight ? 'bg-[#F9F8F6] text-stone-900' : 'bg-neutral-950 text-white'
        }`}
      >
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        <p
          className={`text-sm font-medium ${
            isLight ? 'text-stone-500' : 'text-neutral-400'
          }`}
        >
          Memuat galeri acara...
        </p>
      </div>
    );
  }

  const activeLightboxPhoto =
    lightboxIndex !== null ? currentPhotos[lightboxIndex] : null;

  return (
    <div
      className={`min-h-screen pb-28 transition-colors duration-200 ${
        isLight ? 'bg-[#F9F8F6] text-stone-900' : 'bg-neutral-950 text-neutral-100'
      }`}
    >
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

      <GuestGalleryHeader
        eventName={event?.name || headline}
        headline={headline}
        headerSubtitle={headerSubtitle}
        headerImageUrl={event?.header_image_url}
        themeColor={themeColor}
        isArchived={isArchived}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        photographerCount={photosByTab.photographer.length}
        guestCount={photosByTab.guest.length}
        galleryTheme={event?.gallery_theme || 'dark'}
        archiveInfo={archiveInfo}
      />

      <main className="max-w-2xl mx-auto px-3 sm:px-4 pt-3">
        {/* Guest Sub-Filter & Search Bar (Only on Galeri Tamu Tab) */}
        {activeTab === 'guest' && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              {/* Category Segment: Semua vs Foto Saya */}
              <div
                className={`flex items-center gap-1 p-1 rounded-2xl text-xs shadow-inner ${
                  isLight
                    ? 'bg-stone-200/80 border border-stone-300/70'
                    : 'bg-neutral-900/90 border border-white/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setGuestViewFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    guestViewFilter === 'all'
                      ? isLight
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'bg-white text-neutral-950 shadow-md'
                      : isLight
                        ? 'text-stone-600 hover:text-stone-900'
                        : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Semua ({photosByTab.guest.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGuestViewFilter('my_photos')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                    guestViewFilter === 'my_photos'
                      ? 'text-neutral-950 shadow-md scale-[1.02]'
                      : isLight
                        ? 'text-stone-600 hover:text-stone-900'
                        : 'text-neutral-400 hover:text-white'
                  }`}
                  style={
                    guestViewFilter === 'my_photos'
                      ? { backgroundColor: themeColor }
                      : undefined
                  }
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>Foto Saya ({myPhotosCount})</span>
                </button>
              </div>

              {/* Minimalist Search Input */}
              <div className="relative flex-1 max-w-[170px] sm:max-w-[210px]">
                <Search
                  className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isLight ? 'text-stone-400' : 'text-neutral-400'
                  }`}
                />
                <input
                  type="text"
                  placeholder="Cari nama..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-8 pr-7 py-1.5 rounded-xl border text-xs transition-all focus:outline-none ${
                    isLight
                      ? 'bg-white border-stone-300/80 text-stone-900 placeholder-stone-400 focus:border-stone-500 shadow-sm'
                      : 'bg-neutral-900/90 border border-white/10 text-white placeholder-neutral-500 focus:border-white/30'
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 ${
                      isLight
                        ? 'text-stone-400 hover:text-stone-700'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Active Query Info */}
            {searchQuery && (
              <div
                className={`text-[11px] flex items-center justify-between px-1 ${
                  isLight ? 'text-stone-500' : 'text-neutral-400'
                }`}
              >
                <span>
                  Hasil pencarian &ldquo;{searchQuery}&rdquo;: {currentPhotos.length} foto
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-amber-500 hover:underline font-medium"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        )}

        {currentPhotos.length === 0 ? (
          <div
            className={`py-16 px-4 text-center rounded-3xl border border-dashed ${
              isLight
                ? 'bg-white/80 border-stone-300/80 shadow-sm'
                : 'bg-neutral-900/40 border-white/15'
            }`}
          >
            <Sparkles
              className="w-9 h-9 mx-auto mb-2.5"
              style={{ color: themeColor }}
            />
            <p
              className={`text-sm font-bold ${
                isLight ? 'text-stone-900' : 'text-white'
              }`}
            >
              {guestViewFilter === 'my_photos'
                ? 'Anda belum memiliki foto di galeri ini'
                : searchQuery
                  ? `Tidak ada foto dengan nama "${searchQuery}"`
                  : activeTab === 'photographer'
                    ? 'Menanti foto pertama dari tim fotografer'
                    : 'Belum ada kiriman foto dari tamu'}
            </p>
            <p
              className={`text-xs mt-1 max-w-sm mx-auto ${
                isLight ? 'text-stone-500' : 'text-neutral-400'
              }`}
            >
              {guestViewFilter === 'my_photos'
                ? 'Bagikan momen Anda sekarang untuk langsung melihat koleksi foto Anda di sini.'
                : searchQuery
                  ? 'Periksa kembali ejaan nama atau ketuk Reset untuk melihat semua foto.'
                  : activeTab === 'photographer'
                    ? 'Dokumentasi resmi akan tampil secara otomatis di halaman ini.'
                    : 'Ketuk tombol Bagikan Momen di kanan bawah untuk mengunggah foto Anda.'}
            </p>

            {guestViewFilter === 'my_photos' && !isArchived && remainingQuota > 0 && (
              <button
                type="button"
                onClick={handleFabClick}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-neutral-950 inline-flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform"
                style={{ backgroundColor: themeColor }}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Unggah Foto Sekarang</span>
              </button>
            )}
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 gap-3 space-y-3">
            {currentPhotos.map((photo, index) => {
              const isMyPhoto = isPhotoMine(photo);

              return (
                <div
                  key={photo.id}
                  onClick={() => setLightboxIndex(index)}
                  className={`break-inside-avoid relative group rounded-2xl overflow-hidden border shadow-lg cursor-pointer active:scale-[0.98] transition-all ${
                    isLight
                      ? 'bg-white border-stone-200/90'
                      : 'bg-neutral-900 border-white/10 hover:border-white/20'
                  } ${
                    isMyPhoto
                      ? 'border-amber-400 ring-2 ring-amber-400/30'
                      : ''
                  }`}
                >
                  <img
                    src={photo.thumbnail_url || photo.url}
                    alt={
                      photo.guest_name
                        ? `Potret oleh ${photo.guest_name}`
                        : 'Dokumentasi Acara'
                    }
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto object-cover block group-hover:scale-105 transition-transform duration-500"
                  />

                  {photo.source === 'guest' && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent p-2.5 pt-7">
                      <div className="flex items-center gap-1.5 max-w-full">
                        {isMyPhoto && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-400 text-neutral-950 font-extrabold text-[10px] shadow-sm flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            <span>Anda</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-white truncate max-w-full">
                          <span className="truncate">
                            {photo.guest_name || 'Tamu'}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hasMoreByTab[activeTab] && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className={`px-5 py-2.5 rounded-full text-xs font-bold border flex items-center gap-2 transition-colors ${
                isLight
                  ? 'bg-white hover:bg-stone-50 border-stone-300/80 text-stone-800 shadow-sm'
                  : 'bg-neutral-900 hover:bg-neutral-800 border-white/15 text-neutral-200'
              }`}
            >
              {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Tampilkan foto lainnya
            </button>
          </div>
        )}
      </main>

      {!isArchived && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleFabClick}
            aria-label="Bagikan Momen"
            className="fixed bottom-6 right-5 z-40 flex items-center gap-2.5 pl-3.5 pr-5 py-3.5 rounded-full text-neutral-950 font-extrabold text-sm shadow-[0_10px_30px_rgba(0,0,0,0.6)] border-2 border-white/30 active:scale-95 transition-transform"
            style={{ backgroundColor: themeColor }}
          >
            <div className="relative w-8 h-8 rounded-full bg-black/15 flex items-center justify-center">
              <Camera className="w-4 h-4 stroke-[2.4]" />
              <Plus className="w-3 h-3 stroke-[3] -ml-0.5 -mt-2" />
            </div>
            <span>Bagikan Momen</span>
          </button>
        </>
      )}

      {activeLightboxPhoto && lightboxIndex !== null && (
        <GuestLightboxModal
          photo={activeLightboxPhoto}
          currentIndex={lightboxIndex}
          totalPhotos={currentPhotos.length}
          headline={headline}
          themeColor={themeColor}
          onClose={() => setLightboxIndex(null)}
          onPrev={handlePrevPhoto}
          onNext={handleNextPhoto}
          onDownload={handleDirectDownload}
        />
      )}

      {isUploadModalOpen && (
        <GuestUploadModal
          themeColor={themeColor}
          uploadLimit={uploadLimit}
          remainingQuota={remainingQuota}
          guestNameInput={guestNameInput}
          onChangeGuestName={setGuestNameInput}
          capturedQueue={capturedQueue}
          onAddCapturedShot={handleAddCapturedShot}
          onRemoveCapturedShot={handleRemoveCapturedShot}
          onOpenFilePicker={() => fileInputRef.current?.click()}
          uploading={uploading}
          onSubmitUpload={handleConfirmUpload}
          onClose={closeUploadModal}
          showToast={showToast}
        />
      )}
    </div>
  );
}
