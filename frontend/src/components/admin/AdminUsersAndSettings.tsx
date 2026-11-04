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
      showToast('Akun operator disimpan.');
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  const handleRemoveOperator = (id: string) => {
    if (operators.length <= 1) {
      showToast('Minimal harus ada 1 akun aktif.');
      return;
    }
    const updated = operators.filter((op) => op.id !== id);
    saveStoredOperatorAccounts(updated);
    setOperators(updated);
    showToast('Akun operator dihapus.');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-5 border-b border-white/[0.07]">
        <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 font-medium">
          Akses Workspace
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F5F4F0] mt-1">
          Tim Operator
        </h1>
      </div>

      <form
        onSubmit={handleAddOperator}
        className="p-4 rounded-lg bg-[#121211] border border-white/[0.07] grid sm:grid-cols-4 gap-3"
      >
        <input
          type="text"
          required
          placeholder="Nama Lengkap"
          value={newUserForm.name}
          onChange={(e) =>
            setNewUserForm({ ...newUserForm, name: e.target.value })
          }
          className="px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.08] text-xs text-[#F5F4F0] placeholder:text-neutral-600 focus:outline-none focus:border-white/25"
        />
        <input
          type="email"
          required
          placeholder="Alamat Email"
          value={newUserForm.email}
          onChange={(e) =>
            setNewUserForm({ ...newUserForm, email: e.target.value })
          }
          className="px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.08] text-xs text-[#F5F4F0] placeholder:text-neutral-600 focus:outline-none focus:border-white/25"
        />
        <input
          type="password"
          required
          placeholder="Kata Sandi"
          value={newUserForm.password}
          onChange={(e) =>
            setNewUserForm({ ...newUserForm, password: e.target.value })
          }
          className="px-3 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.08] text-xs text-[#F5F4F0] placeholder:text-neutral-600 focus:outline-none focus:border-white/25"
        />
        <button
          type="submit"
          className="py-2 px-4 rounded-md bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] font-medium text-xs transition-colors"
        >
          Simpan Operator
        </button>
      </form>

      <div className="rounded-lg bg-[#121211] border border-white/[0.07] divide-y divide-white/[0.05]">
        {operators.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between px-5 py-3.5 text-xs"
          >
            <div>
              <div className="font-medium text-[#F5F4F0]">{u.name}</div>
              <div className="text-neutral-500 font-mono text-[11px] mt-0.5">
                {u.email}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRemoveOperator(u.id)}
              className="p-1.5 rounded text-neutral-500 hover:text-rose-300 hover:bg-rose-950/50 transition-colors"
              title="Hapus Operator"
            >
              <Trash2 className="w-3.5 h-3.5" />
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="pb-5 border-b border-white/[0.07]">
        <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 font-medium">
          Konfigurasi Server
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F5F4F0] mt-1">
          Kunci Akses API
        </h1>
      </div>

      <div className="p-5 rounded-lg bg-[#121211] border border-white/[0.07] space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral-300">
            Bearer Token Server (`ADMIN_API_TOKEN`)
          </label>
          <input
            type="text"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="w-full px-3.5 py-2 rounded-md bg-[#0B0B0A] border border-white/[0.08] text-xs font-mono text-[#F5F4F0] focus:outline-none focus:border-white/25"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setAdminToken(tokenInput.trim());
            void onTokenSaved();
            showToast('Kunci akses disimpan.');
          }}
          className="px-4 py-2 rounded-md bg-[#F5F4F0] hover:bg-white text-[#0E0E0D] font-medium text-xs transition-colors"
        >
          Simpan Perubahan
        </button>
      </div>
    </div>
  );
}
