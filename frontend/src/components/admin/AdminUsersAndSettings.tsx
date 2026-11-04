'use client';

import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  AdminUserItem,
  createAdminUser,
  fetchAdminUsers,
  getAdminToken,
  setAdminToken,
} from '@/lib/admin-api';

export interface StoredOperatorAccount {
  id: string;
  name: string;
  email: string;
  password: string;
}

const OPERATORS_STORAGE_KEY = 'sava_admin_operators_v1';

export const DEFAULT_OPERATOR_ACCOUNTS: StoredOperatorAccount[] = [
  {
    id: 'op-default-1',
    name: 'Erry (Super Admin)',
    email: 'erryerf@gmail.com',
    password: 'sava2026',
  },
  {
    id: 'op-default-2',
    name: 'Admin SAVA',
    email: 'admin@sava-app.cloud',
    password: 'sava2026',
  },
];

export function getStoredOperatorAccounts(): StoredOperatorAccount[] {
  if (typeof window === 'undefined') return DEFAULT_OPERATOR_ACCOUNTS;
  try {
    const raw = window.localStorage.getItem(OPERATORS_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(
        OPERATORS_STORAGE_KEY,
        JSON.stringify(DEFAULT_OPERATOR_ACCOUNTS),
      );
      return DEFAULT_OPERATOR_ACCOUNTS;
    }
    const parsed = JSON.parse(raw) as StoredOperatorAccount[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_OPERATOR_ACCOUNTS;
  } catch {
    return DEFAULT_OPERATOR_ACCOUNTS;
  }
}

export function saveStoredOperatorAccounts(accounts: StoredOperatorAccount[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(OPERATORS_STORAGE_KEY, JSON.stringify(accounts));
}

interface AdminUsersSectionProps {
  isDemoMode: boolean;
  showToast: (msg: string) => void;
}

export function AdminUsersSection({
  isDemoMode,
  showToast,
}: AdminUsersSectionProps) {
  const [operators, setOperators] = useState<StoredOperatorAccount[]>([]);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    const localOps = getStoredOperatorAccounts();
    setOperators(localOps);

    if (!isDemoMode) {
      void fetchAdminUsers()
        .then((remoteUsers: AdminUserItem[]) => {
          if (remoteUsers.length > 0) {
            const merged = [...localOps];
            for (const ru of remoteUsers) {
              if (
                !merged.some(
                  (m) => m.email.toLowerCase() === ru.email.toLowerCase(),
                )
              ) {
                merged.push({
                  id: ru.id,
                  name: ru.name,
                  email: ru.email,
                  password: '********',
                });
              }
            }
            setOperators(merged);
          }
        })
        .catch(() => {});
    }
  }, [isDemoMode]);

  const handleAddOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newUserForm.email.trim().toLowerCase();
    const cleanName = newUserForm.name.trim();
    const cleanPassword = newUserForm.password;

    if (!cleanEmail || !cleanName || !cleanPassword) return;

    try {
      if (!isDemoMode) {
        await createAdminUser({
          name: cleanName,
          email: cleanEmail,
          password: cleanPassword,
        }).catch(() => {});
      }

      const existing = getStoredOperatorAccounts();
      const filtered = existing.filter(
        (u) => u.email.toLowerCase() !== cleanEmail,
      );
      const updated: StoredOperatorAccount[] = [
        {
          id: `op-${Date.now()}`,
          name: cleanName,
          email: cleanEmail,
          password: cleanPassword,
        },
        ...filtered,
      ];
      saveStoredOperatorAccounts(updated);
      setOperators(updated);
      setNewUserForm({ name: '', email: '', password: '' });
      showToast('Akun operator berhasil disimpan!');
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const handleRemoveOperator = (id: string) => {
    if (operators.length <= 1) {
      showToast('Minimal harus ada 1 akun admin aktif.');
      return;
    }
    const updated = operators.filter((op) => op.id !== id);
    saveStoredOperatorAccounts(updated);
    setOperators(updated);
    showToast('Akun operator dihapus.');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">
          Manajemen Operator / Admin
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Kelola akun email &amp; password yang diizinkan masuk ke Admin Dashboard.
        </p>
      </div>

      <form
        onSubmit={handleAddOperator}
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
          placeholder="Email Login"
          value={newUserForm.email}
          onChange={(e) =>
            setNewUserForm({ ...newUserForm, email: e.target.value })
          }
          className="px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/15 text-xs text-white"
        />
        <input
          type="password"
          required
          placeholder="Password Baru"
          value={newUserForm.password}
          onChange={(e) =>
            setNewUserForm({ ...newUserForm, password: e.target.value })
          }
          className="px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/15 text-xs text-white"
        />
        <button
          type="submit"
          className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs transition"
        >
          + Simpan / Ubah Password
        </button>
      </form>

      <div className="p-5 rounded-2xl bg-neutral-900 border border-white/10 text-xs text-neutral-300 space-y-2">
        {operators.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
          >
            <div>
              <div className="font-bold text-white">{u.name}</div>
              <div className="text-neutral-400 font-mono text-[11px]">
                {u.email}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRemoveOperator(u.id)}
              className="p-2 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
              title="Hapus Operator"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
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
