'use client';

import React from 'react';
import { Camera, FileArchive, Loader2, Users } from 'lucide-react';
import { ArchiveStatus, PhotoSource } from '@/lib/types';

interface GuestGalleryHeaderProps {
  eventName: string;
  headline: string;
  headerSubtitle: string | null | undefined;
  headerImageUrl: string | null | undefined;
  themeColor: string;
  isArchived: boolean;
  activeTab: PhotoSource;
  onSelectTab: (tab: PhotoSource) => void;
  photographerCount: number;
  guestCount: number;
  archiveInfo: {
    status: ArchiveStatus;
    download_url: string | null;
  };
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

export default function GuestGalleryHeader({
  eventName,
  headline,
  headerSubtitle,
  headerImageUrl,
  themeColor,
  isArchived,
  activeTab,
  onSelectTab,
  photographerCount,
  guestCount,
  archiveInfo,
}: GuestGalleryHeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-30 shadow-2xl">
        <div
          className="relative overflow-hidden border-b border-white/15"
          style={{
            background: `linear-gradient(145deg, ${themeColor} 0%, #1A1610 60%, #09090B 100%)`,
          }}
        >
          {headerImageUrl && (
            <>
              <img
                src={headerImageUrl}
                alt={eventName}
                className="absolute inset-0 w-full h-full object-cover object-center brightness-[0.38] contrast-105 scale-105 pointer-events-none select-none"
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.52) 55%, rgba(9,9,11,0.92) 100%)',
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
                ? 'Koleksi dokumentasi resmi • Ketuk foto untuk mengunduh'
                : 'Dokumentasi langsung & perspektif pilihan para tamu'}
            </p>
          </div>
        </div>

        <div className="bg-neutral-950/90 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-2xl mx-auto px-3.5 py-2.5">
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-neutral-900/95 border border-white/10 shadow-inner">
              <button
                type="button"
                onClick={() => onSelectTab('guest')}
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
                <span>Galeri Tamu</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${
                    activeTab === 'guest'
                      ? 'bg-black/20 text-neutral-950 font-extrabold'
                      : 'bg-white/10 text-neutral-300'
                  }`}
                >
                  {guestCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('photographer')}
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
                  {photographerCount}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

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
                  Unduh Arsip Dokumentasi (.ZIP)
                </p>
                <p className="text-xs text-neutral-400">
                  Tersusun rapi dalam folder Kamera Utama &amp; Galeri Tamu
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
                Menyiapkan arsip...
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
