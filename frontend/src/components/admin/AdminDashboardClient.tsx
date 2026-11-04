'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchAdminEvents } from '@/lib/admin-api';
import { AdminEvent, EventStatus } from '@/lib/types';
import AdminSidebar, { AdminNavSection } from './AdminSidebar';
import {
  AdminSettingsSection,
  AdminUsersSection,
  getStoredOperatorAccounts,
} from './AdminUsersAndSettings';
import { getStoredDemoEvents } from './demo-data';
import EventControlRoom from './EventControlRoom';
import EventListSection from './EventListSection';
import {
  CreateEventWizardModal,
  DeleteEventModal,
  EditEventModal,
} from './EventModals';

const ADMIN_SESSION_STORAGE_KEY = 'sava_admin_session_v1';

export default function AdminDashboardClient() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

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

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAdminEvents(
        statusFilter === 'all' ? undefined : statusFilter,
      );
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

  // STUDIO LOGIN SCREEN
  if (!loggedInEmail) {
    return (
      <div className="min-h-screen bg-[#0B0B0A] text-[#F5F4F0] flex flex-col justify-between px-4 py-8">
        <header className="max-w-6xl w-full mx-auto flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold tracking-[0.06em]">
              SAVA
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">
              Studio
            </span>
          </div>
          <span className="text-xs text-neutral-500">Live Event Platform</span>
        </header>

        <main className="w-full max-w-sm mx-auto space-y-7">
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 font-medium">
              Akses Internal
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#F5F4F0]">
              Masuk ke Workspace
            </h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Gunakan akun operator SAVA untuk mengelola acara dan transmisi
              kamera.
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
                className="w-full px-3.5 py-2.5 rounded-md bg-[#121211] border border-white/[0.09] text-sm text-[#F5F4F0] placeholder:text-neutral-600 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-300">
                Kata Sandi
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={loginPasswordInput}
                onChange={(e) => setLoginPasswordInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-md bg-[#121211] border border-white/[0.09] text-sm text-[#F5F4F0] placeholder:text-neutral-600 focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-md bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] font-medium text-xs transition-colors mt-2"
            >
              Masuk
            </button>
          </form>
        </main>

        <footer className="max-w-6xl w-full mx-auto flex items-center justify-between text-[11px] text-neutral-600">
          <span>&copy; {new Date().getFullYear()} SAVA Documentation</span>
          <span>sava-app.cloud</span>
        </footer>
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
