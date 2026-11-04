'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchAdminEvents } from '@/lib/admin-api';
import { AdminEvent, EventStatus } from '@/lib/types';
import AdminSidebar, { AdminNavSection } from './AdminSidebar';
import {
  AdminSettingsSection,
  AdminUsersSection,
} from './AdminUsersAndSettings';
import { getStoredDemoEvents } from './demo-data';
import EventControlRoom from './EventControlRoom';
import EventListSection from './EventListSection';
import {
  CreateEventWizardModal,
  DeleteEventModal,
  EditEventModal,
} from './EventModals';

export default function AdminDashboardClient() {
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
    void loadEvents();
  }, [loadEvents]);

  const handleEventUpdated = (updated: AdminEvent) => {
    setSelectedEvent(updated);
    setEvents((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
  };

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
        onSelectNav={(section) => {
          setSelectedEvent(null);
          setNavSection(section);
        }}
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
