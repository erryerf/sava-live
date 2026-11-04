'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
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
      setLoginError('Email atau password tidak sesuai.');
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, matched.email);
    }
    setLoggedInEmail(matched.email);
    setLoginPasswordInput('');
    showToast(`Selamat datang, ${matched.name}! ✨`);
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
    return <div className="min-h-screen bg-neutral-950" />;
  }

  // LOGIN GATE (Sesuai /ui-ux-flow 3.A: Autentikasi Login Email & Password)
  if (!loggedInEmail) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-neutral-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-7 sm:p-8 shadow-2xl space-y-6 relative z-10">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-neutral-950 flex items-center justify-center font-black text-xl mx-auto shadow-lg">
              S
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SAVA Live Operator Console</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Login Admin &amp; Operator
            </h1>
            <p className="text-xs text-neutral-400">
              Masuk untuk mengelola acara, kredensial FTP kamera, dan moderasi
              galeri.
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-semibold text-rose-300 text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Email Operator
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="erryerf@gmail.com"
                  value={loginEmailInput}
                  onChange={(e) => setLoginEmailInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-neutral-950 border border-white/15 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPasswordInput}
                  onChange={(e) => setLoginPasswordInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-neutral-950 border border-white/15 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-extrabold text-sm shadow-lg transition"
            >
              Masuk ke Ruang Kontrol
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-neutral-900 border border-white/15 text-sm font-semibold text-white shadow-2xl">
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
      <div className="flex-1 p-8 overflow-y-auto">
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
