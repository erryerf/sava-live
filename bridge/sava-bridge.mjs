#!/usr/bin/env node
/**
 * Sava Live Desktop Bridge (Universal Hot-Folder Agent)
 * -----------------------------------------------------
 * Memantau folder penyimpanan dari Canon EOS Utility, Sony Imaging Edge,
 * Nikon NX Tether, Fujifilm X Acquire, Lightroom, atau Capture One,
 * lalu otomatis mengunggah foto JPEG/PNG/WebP baru ke Sava Live.
 *
 * Fitur:
 * - Zero dependencies (cukup Node.js 18+)
 * - Smart Filter: Hanya ambil .jpg/.jpeg/.png/.webp (abaikan RAW & file .tmp)
 * - Stability Check: Tunggu file selesai ditulis kamera sebelum upload
 * - Offline Queue & Auto-Retry: Foto tidak hilang jika Wi-Fi venue putus sementara
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const DEFAULT_API_URL = process.env.SAVA_API_URL || 'https://sava-app.cloud/v1';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = 'true';
      }
    }
  }
  return args;
}

function askQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, (ans) => resolve(ans.trim())));
}

function getMimeType(ext) {
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

async function waitForFileReady(filePath, timeoutMs = 10000) {
  const start = Date.now();
  let lastSize = -1;
  let stableCount = 0;

  while (Date.now() - start < timeoutMs) {
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.size > 0 && stat.size === lastSize) {
        stableCount++;
        if (stableCount >= 2) {
          return stat.size;
        }
      } else {
        stableCount = 0;
        lastSize = stat.size;
      }
    } catch {
      return 0;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return lastSize > 0 ? lastSize : 0;
}

function loadSyncHistory(historyFile) {
  try {
    if (fs.existsSync(historyFile)) {
      const parsed = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    // Ignore corrupted history file
  }
  return new Set();
}

function saveSyncHistory(historyFile, syncedSet) {
  try {
    const entries = Array.from(syncedSet).slice(-5000);
    fs.writeFileSync(historyFile, JSON.stringify(entries, null, 2));
  } catch {
    // Ignore write error
  }
}

async function uploadPhotoFile({ apiUrl, slug, filePath, fileName }) {
  const ext = path.extname(fileName).toLowerCase();
  const mimeType = getMimeType(ext);
  const buffer = await fs.promises.readFile(filePath);
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const endpoint = `${apiUrl.replace(/\/+$/, '')}/events/${encodeURIComponent(slug)}/photos/direct-upload`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_data: dataUrl,
      guest_identifier: `desktop_bridge_${process.platform}`,
      source: 'photographer',
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 160)}`);
  }

  return res.json();
}

async function main() {
  const args = parseArgs(process.argv);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n=================================================');
  console.log('   SAVA LIVE — DESKTOP HOT-FOLDER BRIDGE v1.0');
  console.log('=================================================\n');

  const apiUrl = args.api || DEFAULT_API_URL;
  let slug = args.slug || process.env.SAVA_EVENT_SLUG || '';
  let watchDir = args.dir || process.env.SAVA_WATCH_DIR || '';

  if (!slug) {
    slug = await askQuestion(rl, 'Masukkan Slug Acara (contoh: erry-selvi): ');
  }
  if (!watchDir) {
    watchDir = await askQuestion(rl, 'Masukkan Path Folder Foto (contoh: D:\\FotoAcara): ');
  }
  rl.close();

  if (!slug || !watchDir) {
    console.error('[ERROR] Slug acara dan folder foto wajib diisi.');
    process.exit(1);
  }

  const resolvedDir = path.resolve(watchDir.replace(/^["']|["']$/g, ''));
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
    console.log(`[INFO] Folder dibuat otomatis: ${resolvedDir}`);
  }

  // Verify event exists
  try {
    const checkRes = await fetch(
      `${apiUrl.replace(/\/+$/, '')}/events/${encodeURIComponent(slug)}`,
    );
    if (!checkRes.ok) {
      console.warn(`[PERINGATAN] Acara "${slug}" belum merespons (${checkRes.status}). Tetap memantau...`);
    } else {
      const info = await checkRes.json();
      console.log(`[TERHUBUNG] Acara: ${info?.data?.name || slug}`);
    }
  } catch (err) {
    console.warn(`[OFFLINE] Tidak dapat cek acara saat ini (${err.message}). Antrean tetap aktif.`);
  }

  const historyFile = path.join(resolvedDir, '.sava-synced.json');
  const syncedFiles = loadSyncHistory(historyFile);
  const pendingQueue = [];
  const queuedNames = new Set();

  const skipExisting = args['skip-existing'] === 'true';
  if (skipExisting) {
    for (const name of fs.readdirSync(resolvedDir)) {
      const ext = path.extname(name).toLowerCase();
      if (ALLOWED_EXTENSIONS.has(ext)) {
        syncedFiles.add(name);
      }
    }
    saveSyncHistory(historyFile, syncedFiles);
    console.log(`[INFO] Melewati ${syncedFiles.size} foto lama (--skip-existing).`);
  }

  const enqueueFile = (fileName) => {
    if (!fileName || fileName.startsWith('.')) return;
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) return;
    if (syncedFiles.has(fileName) || queuedNames.has(fileName)) return;

    const fullPath = path.join(resolvedDir, fileName);
    queuedNames.add(fileName);
    pendingQueue.push({ fileName, fullPath, retries: 0 });
  };

  const scanDirectory = () => {
    try {
      const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          enqueueFile(entry.name);
        }
      }
    } catch {
      // Ignore transient folder access error
    }
  };

  let isProcessing = false;
  const processQueue = async () => {
    if (isProcessing || pendingQueue.length === 0) return;
    isProcessing = true;

    while (pendingQueue.length > 0) {
      const item = pendingQueue[0];
      try {
        if (!fs.existsSync(item.fullPath)) {
          pendingQueue.shift();
          queuedNames.delete(item.fileName);
          continue;
        }

        const size = await waitForFileReady(item.fullPath);
        if (size <= 0) {
          pendingQueue.shift();
          queuedNames.delete(item.fileName);
          continue;
        }

        const sizeKB = Math.round(size / 1024);
        console.log(`[UPLOAD] Mengirim ${item.fileName} (${sizeKB} KB)...`);

        await uploadPhotoFile({
          apiUrl,
          slug,
          filePath: item.fullPath,
          fileName: item.fileName,
        });

        syncedFiles.add(item.fileName);
        saveSyncHistory(historyFile, syncedFiles);
        pendingQueue.shift();
        queuedNames.delete(item.fileName);
        console.log(`[SUKSES] ${item.fileName} sudah tayang di Live Wall!`);
      } catch (err) {
        item.retries++;
        console.warn(
          `[RETRY #${item.retries}] Gagal kirim ${item.fileName}: ${err.message}. Coba lagi dalam 5 detik...`,
        );
        // Move to back of queue and pause before retry
        pendingQueue.shift();
        if (item.retries <= 20) {
          pendingQueue.push(item);
        } else {
          queuedNames.delete(item.fileName);
          console.error(`[GAGAL] Menyerah mengirim ${item.fileName} setelah 20 percobaan.`);
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    isProcessing = false;
  };

  console.log(`[MEMANTAU] Folder : ${resolvedDir}`);
  console.log(`[TARGET]   Server : ${apiUrl}/events/${slug}`);
  console.log(`[FILTER]   Hanya .jpg/.jpeg/.png/.webp (RAW & .tmp diabaikan otomatis)`);
  console.log('\nSiap menerima foto dari Canon EOS Utility / Sony Imaging Edge / Nikon NX Tether!');
  console.log('Tekan Ctrl+C untuk berhenti.\n');

  // Initial scan + watch + polling fallback
  scanDirectory();
  void processQueue();

  try {
    fs.watch(resolvedDir, (_eventType, fileName) => {
      if (fileName) {
        enqueueFile(fileName.toString());
        void processQueue();
      }
    });
  } catch {
    // Fallback strictly to polling below
  }

  setInterval(() => {
    scanDirectory();
    void processQueue();
  }, 1500);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

