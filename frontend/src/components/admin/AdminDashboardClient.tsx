'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { fetchAdminEvents } from '@/lib/admin-api';
import { AdminEvent, EventStatus } from '@/lib/types';
import AdminSidebar, { AdminNavSection } from './AdminSidebar';
import {
  AdminSettingsSection,
  AdminUsersSection,
  getStoredOperatorAccounts,
} from './AdminUsersAndSettings';
import {
  getStoredDemoEvents,
  saveStoredDemoEvents,
} from './demo-data';
import EventControlRoom from './EventControlRoom';
import EventListSection from './EventListSection';
import {
  CreateEventWizardModal,
  DeleteEventModal,
  EditEventModal,
} from './EventModals';

const ADMIN_SESSION_STORAGE_KEY = 'sava_admin_session_v1';

const EDITORIAL_SHOWCASE = [
  {
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=85',
    title: 'The Reception of Budi & Ani',
    category: 'Wedding Documentation',
    exif: 'ILCE-7RM5 • 50mm f/1.2 GM • 0.4s FTP Sync',
  },
  {
    url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1600&q=85',
    title: 'Intimate Vows at Glasshouse',
    category: 'Editorial Portrait',
    exif: 'EOS R5 • 85mm f/1.4L • Instant Live Wall',
  },
  {
    url: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1600&q=85',
    title: 'Evening Gala & First Dance',
    category: 'Live Gallery Experience',
    exif: 'Z8 • 35mm f/1.2 S • Direct R2 Archive',
  },
];

export default function AdminDashboardClient() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [portalMode, setPortalMode] = useState<'operator' | 'guest'>('operator');
  const [showSlideIdx, setShowSlideIdx] = useState(0);

  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [guestCodeInput, setGuestCodeInput] = useState('');

  const [navSection, setNavSection] = useState<AdminNavSection>('events');
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all');
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [originUrl, setOriginUrl] = useState('http://localhost:3000');

  // Selected Event & Modals State
  const [selectedEvent, setSelectedEvent] = useState<AdminEvent | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<AdminEvent | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOriginUrl(process.env.NEXT_PUBLIC_APP_URL || window.location.origin);
      const savedSession = window.localStorage.getItem(
        ADMIN_SESSION_STORAGE_KEY,
      );
      if (savedSession) {
        setLoggedInEmail(savedSession);
      }
      setAuthChecked(true);
    }
  }, []);

  // Auto-cycle editorial showcase on the login page
  useEffect(() => {
    if (loggedInEmail) return;
    const timer = setInterval(() => {
      setShowSlideIdx((prev) => (prev + 1) % EDITORIAL_SHOWCASE.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [loggedInEmail]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const localStored = getStoredDemoEvents();
      if (localStored.length > 0) {
        await fetch('/v1/admin/events/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: localStored }),
        }).catch(() => {});
      }

      const list = await fetchAdminEvents(
        statusFilter === 'all' ? undefined : statusFilter,
      );
      if (statusFilter === 'all') {
        saveStoredDemoEvents(list);
      }
      setEvents(list);
      setIsDemoMode(false);
    } catch {
      setIsDemoMode(true);
      const stored = getStoredDemoEvents();
      setEvents(
        statusFilter === 'all'
          ? stored
          : stored.filter((e) => e.status === statusFilter),
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (loggedInEmail) {
      void loadEvents();
    }
  }, [loadEvents, loggedInEmail]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const emailClean = loginEmailInput.trim().toLowerCase();
    const passClean = loginPasswordInput;

    const accounts = getStoredOperatorAccounts();
    const matched = accounts.find(
      (acc) =>
        acc.email.toLowerCase() === emailClean && acc.password === passClean,
    );

    if (!matched) {
      setLoginError('Email atau kata sandi tidak sesuai.');
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, matched.email);
    }
    setLoggedInEmail(matched.email);
    setLoginPasswordInput('');
    showToast(`Selamat datang, ${matched.name}`);
  };

  const handleGuestCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = guestCodeInput
      .trim()
      .toLowerCase()
      .replace(/^\/+|\/+$/g, '')
      .replace(/[^a-z0-9-_]/g, '-');
    if (!cleanSlug) return;
    router.push(`/${cleanSlug}`);
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
    setLoggedInEmail(null);
    setSelectedEvent(null);
  };

  const handleEventUpdated = (updated: AdminEvent) => {
    setSelectedEvent(updated);
    setEvents((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
  };

  if (!authChecked) {
    return <div className="min-h-screen bg-[#0B0B0A]" />;
  }

  // SPLIT-SCREEN EDITORIAL STUDIO HOMEPAGE & LOGIN PORTAL
  if (!loggedInEmail) {
    const activeSlide = EDITORIAL_SHOWCASE[showSlideIdx];

    return (
      <div className="min-h-screen bg-[#0B0B0A] text-[#F5F4F0] grid lg:grid-cols-12 selection:bg-white selection:text-black">
        {/* LEFT COLUMN (7/12): Full-Bleed Editorial Photography Showcase */}
        <div className="relative hidden lg:flex lg:col-span-7 xl:col-span-8 flex-col justify-between p-12 overflow-hidden border-r border-white/[0.07] bg-[#080807]">
          {/* Crossfading Editorial Photographs */}
          {EDITORIAL_SHOWCASE.map((slide, idx) => (
            <img
              key={slide.url}
              src={slide.url}
              alt={slide.title}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-out pointer-events-none select-none ${
                idx === showSlideIdx
                  ? 'opacity-55 scale-100'
                  : 'opacity-0 scale-105'
              }`}
            />
          ))}

          {/* Multi-layer Editorial Vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080807] via-[#080807]/45 to-[#080807]/70 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080807]/50 via-transparent to-[#0B0B0A]/90 pointer-events-none" />

          {/* Top Bar over Image */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-3xl font-semibold tracking-[0.08em] text-[#F5F4F0]">
                SAVA
              </span>
              <span className="text-[10px] uppercase tracking-[0.26em] text-amber-400 font-bold">
                LIVE
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-white/70 bg-black/45 backdrop-blur-md px-3 py-1.5 rounded border border-white/[0.1]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{activeSlide.exif}</span>
            </div>
          </div>

          {/* Bottom Editorial Story & Slide Selector */}
          <div className="relative z-10 max-w-2xl space-y-8">
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-amber-200/80 font-medium">
                {activeSlide.category}
              </div>
              <h2 className="font-display text-4xl xl:text-5xl font-normal leading-[1.12] tracking-[0.01em] text-[#F5F4F0]">
                Setiap bidikan kamera, hadir seketika di layar dan genggaman
                tamu.
              </h2>
              <p className="text-sm text-neutral-300/85 max-w-lg leading-relaxed">
                Transmisi otomatis dari kamera fotografer ke galeri acara dan
                layar proyektor dalam hitungan detik, tanpa jeda pemrosesan
                manual.
              </p>
            </div>

            {/* Interactive Slide Indicators & Metadata */}
            <div className="pt-6 border-t border-white/[0.12] flex items-center justify-between gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                  Karya Pilihan
                </div>
                <div className="font-display italic text-lg text-[#F5F4F0] mt-0.5">
                  {activeSlide.title}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {EDITORIAL_SHOWCASE.map((s, idx) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() => setShowSlideIdx(idx)}
                    aria-label={`Slide ${idx + 1}`}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      idx === showSlideIdx
                        ? 'w-10 bg-[#F5F4F0]'
                        : 'w-3 bg-white/25 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5/12): Studio Portal (Operator Login + Guest Event Code) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-between p-7 sm:p-12 bg-[#0B0B0A] relative overflow-hidden">
          {/* Mobile Header + Subtle Background Image on Mobile */}
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2 lg:invisible">
              <span className="font-display text-2xl font-semibold tracking-[0.08em] text-[#F5F4F0]">
                SAVA
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-amber-400 font-bold">
                LIVE
              </span>
            </div>

            {/* Mode Switcher: Operator vs Tamu Acara */}
            <div className="inline-flex p-0.5 rounded-md bg-[#141413] border border-white/[0.08] ml-auto">
              <button
                type="button"
                onClick={() => {
                  setPortalMode('operator');
                  setLoginError(null);
                }}
                className={`px-3 py-1.5 rounded text-xs transition-colors ${
                  portalMode === 'operator'
                    ? 'bg-white/[0.1] text-[#F5F4F0] font-medium'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Operator
              </button>
              <button
                type="button"
                onClick={() => {
                  setPortalMode('guest');
                  setLoginError(null);
                }}
                className={`px-3 py-1.5 rounded text-xs transition-colors ${
                  portalMode === 'guest'
                    ? 'bg-white/[0.1] text-[#F5F4F0] font-medium'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Kode Acara
              </button>
            </div>
          </div>

          {/* Center Form Container */}
          <div className="w-full max-w-sm mx-auto my-10">
            {portalMode === 'operator' ? (
              <div className="space-y-7">
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-medium">
                    Operator Console
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-[#F5F4F0]">
                    Masuk ke Workspace
                  </h1>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Kelola ruang acara, koneksi FTP kamera fotografer, dan
                    moderasi galeri langsung.
                  </p>
                </div>

                {loginError && (
                  <div className="px-3.5 py-2.5 rounded-md bg-rose-950/50 border border-rose-500/25 text-xs text-rose-200">
                    {loginError}
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-300">
                      Alamat Email
                    </label>
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="nama@domain.com"
                      value={loginEmailInput}
                      onChange={(e) => setLoginEmailInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-md bg-[#121211] border border-white/[0.09] text-sm text-[#F5F4F0] placeholder:text-neutral-600 focus:outline-none focus:border-white/35 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-300">
                      Kata Sandi
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={loginPasswordInput}
                        onChange={(e) => setLoginPasswordInput(e.target.value)}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-md bg-[#121211] border border-white/[0.09] text-sm text-[#F5F4F0] placeholder:text-neutral-600 focus:outline-none focus:border-white/35 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-md bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] font-medium text-xs flex items-center justify-center gap-2 transition-colors mt-2"
                  >
                    <span>Masuk ke Ruang Kontrol</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-7">
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-medium">
                    Akses Galeri Tamu
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-[#F5F4F0]">
                    Buka Galeri Acara
                  </h1>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Masukkan kode acara yang tertera pada meja atau layar untuk
                    melihat dan membagikan momen foto.
                  </p>
                </div>

                <form onSubmit={handleGuestCodeSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-300">
                      Kode Acara
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Contoh: budi-ani"
                      value={guestCodeInput}
                      onChange={(e) => setGuestCodeInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-md bg-[#121211] border border-white/[0.09] text-sm font-mono text-[#F5F4F0] placeholder:text-neutral-600 focus:outline-none focus:border-white/35 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-md bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] font-medium text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>Buka Galeri</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Bottom Studio Footer */}
          <div className="flex items-center justify-between text-[11px] text-neutral-600 border-t border-white/[0.06] pt-5">
            <span>&copy; {new Date().getFullYear()} SAVA LIVE</span>
            <span className="font-mono">sava-app.cloud</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0A] text-[#F5F4F0] flex">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-md bg-[#181816] border border-white/[0.12] text-xs font-medium text-[#F5F4F0] shadow-2xl">
          {toast}
        </div>
      )}

      {/* SIDEBAR NAVIGATION */}
      <AdminSidebar
        navSection={navSection}
        isDemoMode={isDemoMode}
        adminEmail={loggedInEmail}
        onSelectNav={(section) => {
          setSelectedEvent(null);
          setNavSection(section);
        }}
        onLogout={handleLogout}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 px-8 py-7 overflow-y-auto">
        {selectedEvent ? (
          <EventControlRoom
            selectedEvent={selectedEvent}
            isDemoMode={isDemoMode}
            originUrl={originUrl}
            onBack={() => setSelectedEvent(null)}
            onEventUpdated={handleEventUpdated}
            onOpenEditModal={(evt) => setEditingEvent(evt)}
            onOpenDeleteModal={(evt) => setDeletingEvent(evt)}
            onReloadEvents={loadEvents}
            showToast={showToast}
          />
        ) : navSection === 'events' ? (
          <EventListSection
            events={events}
            loading={loading}
            statusFilter={statusFilter}
            onChangeFilter={setStatusFilter}
            onOpenCreateWizard={() => setWizardOpen(true)}
            onSelectControlRoom={(evt) => setSelectedEvent(evt)}
            onOpenEditModal={(evt) => setEditingEvent(evt)}
            onOpenDeleteModal={(evt) => setDeletingEvent(evt)}
          />
        ) : navSection === 'users' ? (
          <AdminUsersSection isDemoMode={isDemoMode} showToast={showToast} />
        ) : (
          <AdminSettingsSection
            onTokenSaved={loadEvents}
            showToast={showToast}
          />
        )}
      </div>

      {/* MODALS: CREATE WIZARD, EDIT EVENT, DELETE EVENT */}
      <CreateEventWizardModal
        open={wizardOpen}
        isDemoMode={isDemoMode}
        originUrl={originUrl}
        onClose={() => setWizardOpen(false)}
        onCreatedAndOpenControlRoom={(evt) => {
          setWizardOpen(false);
          setSelectedEvent(evt);
        }}
        onReloadEvents={loadEvents}
        showToast={showToast}
      />

      <EditEventModal
        editingEvent={editingEvent}
        isDemoMode={isDemoMode}
        onClose={() => setEditingEvent(null)}
        onEventSaved={(updated) => {
          if (selectedEvent?.id === updated.id) {
            setSelectedEvent(updated);
          }
        }}
        onReloadEvents={loadEvents}
        showToast={showToast}
      />

      <DeleteEventModal
        deletingEvent={deletingEvent}
        isDemoMode={isDemoMode}
        onClose={() => setDeletingEvent(null)}
        onEventDeleted={(deletedId) => {
          if (selectedEvent?.id === deletedId) {
            setSelectedEvent(null);
          }
        }}
        onReloadEvents={loadEvents}
        showToast={showToast}
      />
    </div>
  );
}
