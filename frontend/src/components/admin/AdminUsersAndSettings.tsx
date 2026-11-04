'use client';

import React, { useEffect, useState } from 'react';
import {
  AdminUserItem,
  createAdminUser,
  fetchAdminUsers,
  getAdminToken,
  setAdminToken,
} from '@/lib/admin-api';

interface AdminUsersSectionProps {
  isDemoMode: boolean;
  showToast: (msg: string) => void;
}

export function AdminUsersSection({
  isDemoMode,
  showToast,
}: AdminUsersSectionProps) {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    if (!isDemoMode) {
      void fetchAdminUsers().then(setUsers);
    }
  }, [isDemoMode]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-extrabold text-white">
        Manajemen Operator / Admin
      </h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            if (!isDemoMode) {
              const created = await createAdminUser(newUserForm);
              setUsers((prev) => [created, ...prev]);
            }
            setNewUserForm({ name: '', email: '', password: '' });
            showToast('Admin baru ditambahkan!');
          } catch (err) {
            showToast((err as Error).message);
          }
        }}
        className="p-5 rounded-2xl bg-neutral-900 border border-white/10 grid sm:grid-cols-4 gap-3"
      >
        <input
          type="text"
          required
          placeholder="Nama Operator"
          value={newUserForm.name}
          onChange={(e) =>
            setNewUserForm({ ...newUserForm, name: e.target.value })
          }
          className="px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/15 text-xs text-white"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={newUserForm.email}
          onChange={(e) =>
            setNewUserForm({ ...newUserForm, email: e.target.value })
          }
          className="px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/15 text-xs text-white"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={newUserForm.password}
          onChange={(e) =>
            setNewUserForm({ ...newUserForm, password: e.target.value })
          }
          className="px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/15 text-xs text-white"
        />
        <button
          type="submit"
          className="py-2.5 px-4 rounded-xl bg-amber-400 text-neutral-950 font-bold text-xs"
        >
          + Tambah Admin
        </button>
      </form>

      <div className="p-5 rounded-2xl bg-neutral-900 border border-white/10 text-xs text-neutral-300 space-y-2">
        {users.length === 0 ? (
          <p className="text-neutral-400">
            Gunakan form di atas untuk mendaftarkan akun operator internal.
          </p>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="flex justify-between py-2 border-b border-white/5"
            >
              <span className="font-bold text-white">{u.name}</span>
              <span className="text-neutral-400">{u.email}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface AdminSettingsSectionProps {
  onTokenSaved: () => Promise<void>;
  showToast: (msg: string) => void;
}

export function AdminSettingsSection({
  onTokenSaved,
  showToast,
}: AdminSettingsSectionProps) {
  const [tokenInput, setTokenInput] = useState('');

  useEffect(() => {
    setTokenInput(getAdminToken());
  }, []);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-extrabold text-white">
        Pengaturan Autentikasi API
      </h1>
      <div className="p-5 rounded-2xl bg-neutral-900 border border-white/10 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
            Admin Bearer Token (`ADMIN_API_TOKEN`)
          </label>
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/15 text-xs font-mono text-white"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setAdminToken(tokenInput.trim());
            void onTokenSaved();
            showToast('Token disimpan!');
          }}
          className="px-4 py-2.5 rounded-xl bg-amber-400 text-neutral-950 font-bold text-xs"
        >
          Simpan Token
        </button>
      </div>
    </div>
  );
}

