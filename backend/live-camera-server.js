const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const { Server } = require('socket.io');
const FtpSrv = require('ftp-srv');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');

const HTTP_PORT = Number(process.env.PORT || 3001);
const FTP_PORT = Number(process.env.FTP_PORT || 2121);

// Cloud Database (Neon) Connection
let dbPool = null;
if (process.env.DATABASE_URL) {
  dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  dbPool.query('SELECT NOW()').then(() => {
    console.log('[LIVE-CAMERA] Connected to Neon Cloud PostgreSQL');
  }).catch((err) => {
    console.warn('[LIVE-CAMERA] PostgreSQL connection notice:', err.message);
  });
}

// Cloud Storage (Cloudflare R2) Client
let s3Client = null;
if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
  const accountId = process.env.R2_ACCOUNT_ID || '8b46f97e1b2c60db108af041e28fda0e';
  s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  console.log('[LIVE-CAMERA] Cloudflare R2 Client initialized');
}

async function uploadToR2(fileKey, filePath, contentType) {
  if (!s3Client) return null;
  const bucketName = process.env.R2_BUCKET_NAME || 'sava-live-gallery';
  const fileBuffer = fs.readFileSync(filePath);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: contentType,
    }),
  );
  return fileKey;
}

async function savePhotoToDatabase(slug, photoData) {
  if (!dbPool) return null;
  try {
    const photoId = photoData.id || `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const res = await dbPool.query(
      `
      INSERT INTO photos (
        id, event_slug, source, guest_name, url, thumbnail_url, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `,
      [
        photoId,
        slug,
        'photographer',
        null,
        photoData.url,
        photoData.thumbnail_url || photoData.url,
        'approved',
      ],
    );

    await dbPool.query('UPDATE events SET ftp_last_upload_at = NOW(), ftp_last_connected_at = NOW() WHERE LOWER(slug) = LOWER($1)', [slug]);
    return res.rows[0];
  } catch (err) {
    console.error('[LIVE-CAMERA] Database save notice:', err.message);
    return null;
  }
}

const TEMP_FTP_ROOT = path.resolve(__dirname, 'temp-ftp');
const UPLOADS_ROOT = path.resolve(__dirname, 'public-uploads');

fs.mkdirSync(TEMP_FTP_ROOT, { recursive: true });
fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
fs.mkdirSync(path.join(TEMP_FTP_ROOT, 'budi-ani'), { recursive: true });

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const app = express();
app.use(express.json({ limit: '25mb' }));

// CORS headers for local frontend
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Serve optimized camera uploads with aggressive immutable browser caching
app.use(
  '/uploads',
  express.static(UPLOADS_ROOT, {
    maxAge: '365d',
    immutable: true,
  }),
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store photos in memory per event slug for instant retrieval
const photosBySlug = new Map();
const activeFtpSessionsBySlug = new Map();
const processedFiles = new Set();

// Bounded Concurrency Worker Queue (prevents CPU/RAM spike on 50+ burst shots)
const MAX_CONCURRENT_JOBS = 3;
let activeJobs = 0;
const jobQueue = [];

function enqueueImageJob(fn) {
  return new Promise((resolve, reject) => {
    jobQueue.push({ fn, resolve, reject });
    drainQueue();
  });
}

function drainQueue() {
  while (activeJobs < MAX_CONCURRENT_JOBS && jobQueue.length > 0) {
    const job = jobQueue.shift();
    activeJobs++;
    Promise.resolve()
      .then(() => job.fn())
      .then(job.resolve)
      .catch(job.reject)
      .finally(() => {
        activeJobs--;
        drainQueue();
      });
  }
}

function recordAndBroadcastPhoto(slug, photoItem) {
  const list = photosBySlug.get(slug) || [];
  photosBySlug.set(
    slug,
    [photoItem, ...list.filter((p) => p.id !== photoItem.id)].slice(0, 200),
  );

  // Strict per-event room isolation: ONLY emit to clients subscribed to event_{slug}
  io.to(`event_${slug}`).emit('NEW_PHOTO', {
    event: 'NEW_PHOTO',
    slug,
    data: photoItem,
  });
  console.log(
    `[LIVE-CAMERA] Broadcasted NEW_PHOTO strictly to room "event_${slug}" -> ${photoItem.url}`,
  );
}

async function processIncomingCameraFile(slug, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    return;
  }

  const fileKey = `${slug}:${filePath}`;
  if (processedFiles.has(fileKey)) return;
  processedFiles.add(fileKey);

  return enqueueImageJob(async () => {
    // Wait briefly to ensure camera / OS finished writing the file
    await new Promise((r) => setTimeout(r, 300));
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      processedFiles.delete(fileKey);
      return;
    }

    try {
      const slugUploadDir = path.join(UPLOADS_ROOT, slug);
      fs.mkdirSync(slugUploadDir, { recursive: true });

      const baseId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const fullFilename = `cam-${baseId}.jpg`;
      const thumbFilename = `thumb-${baseId}.webp`;
      const fullPath = path.join(slugUploadDir, fullFilename);
      const thumbPath = path.join(slugUploadDir, thumbFilename);

      const pipeline = sharp(filePath).rotate(); // Auto-orient based on camera EXIF

      // Optimize full-resolution image: max 2560px 2.5K resolution, strictly under 2MB (max ~1.8MB)
      const MAX_CAMERA_BYTES = 1.95 * 1024 * 1024;
      let fullBuffer = await pipeline
        .clone()
        .resize({
          width: 2560,
          height: 2560,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 86, mozjpeg: true })
        .toBuffer();

      // If extreme detail causes file to exceed 1.95MB, step down compression quality safely
      if (fullBuffer.length > MAX_CAMERA_BYTES) {
        fullBuffer = await pipeline
          .clone()
          .resize({
            width: 2560,
            height: 2560,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 78, mozjpeg: true })
          .toBuffer();
      }

      fs.writeFileSync(fullPath, fullBuffer);

      // Generate 600px fast grid thumbnail (~35KB WebP)
      await pipeline
        .clone()
        .resize({
          width: 600,
          height: 600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 78 })
        .toFile(thumbPath);

      // Delete original temp file after optimization
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore unlink error if locked
      }

      const r2FullKey = `events/${slug}/photographer/${fullFilename}`;
      const r2ThumbKey = `events/${slug}/photographer/${thumbFilename}`;

      let cloudUrl = null;
      let cloudThumbUrl = null;

      try {
        await Promise.all([
          uploadToR2(r2FullKey, fullPath, 'image/jpeg'),
          uploadToR2(r2ThumbKey, thumbPath, 'image/webp'),
        ]);
        const cdnBase = (process.env.CDN_BASE_URL || 'https://pub-0cded6573cff41058ef608531431b6ce.r2.dev').replace(/\/+$/, '');
        if (!cdnBase.includes('.r2.dev')) {
          cloudUrl = `${cdnBase}/${r2FullKey}`;
          cloudThumbUrl = `${cdnBase}/${r2ThumbKey}`;
        } else {
          cloudUrl = `https://sava-app.cloud/v1/photos/asset/${r2FullKey}`;
          cloudThumbUrl = `https://sava-app.cloud/v1/photos/asset/${r2ThumbKey}`;
        }
        console.log(`[LIVE-CAMERA] Uploaded camera shot to Cloudflare R2: ${r2FullKey}`);
      } catch (uploadErr) {
        console.warn('[LIVE-CAMERA] R2 background upload deferred:', uploadErr.message);
      }

      const localIp = getLocalIpAddress();
      const photoItem = {
        id: `ftp-${baseId}`,
        url: cloudUrl || `http://localhost:${HTTP_PORT}/uploads/${encodeURIComponent(slug)}/${fullFilename}`,
        thumbnail_url: cloudThumbUrl || `http://localhost:${HTTP_PORT}/uploads/${encodeURIComponent(slug)}/${thumbFilename}`,
        lan_url: `http://${localIp}:${HTTP_PORT}/uploads/${encodeURIComponent(slug)}/${fullFilename}`,
        file_key: r2FullKey,
        source: 'photographer',
        guest_name: null,
        status: 'approved',
        created_at: new Date().toISOString(),
      };

      await savePhotoToDatabase(slug, photoItem);
      recordAndBroadcastPhoto(slug, photoItem);
    } catch (err) {
      console.error(
        `[LIVE-CAMERA] Failed processing ${filePath}:`,
        err.message,
      );
      processedFiles.delete(fileKey);
    }
  });
}

// Watch temp-ftp/{slug} folders for USB Tethered Camera Shooting as well
const watchedSlugs = new Set();
function ensureSlugFolderWatched(slug) {
  const cleanSlug = slug.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanSlug || watchedSlugs.has(cleanSlug)) return;

  const dir = path.join(TEMP_FTP_ROOT, cleanSlug);
  fs.mkdirSync(dir, { recursive: true });
  watchedSlugs.add(cleanSlug);

  fs.watch(dir, (eventType, filename) => {
    if (!filename) return;
    const fullPath = path.join(dir, filename);
    if (fs.existsSync(fullPath)) {
      void processIncomingCameraFile(cleanSlug, fullPath);
    }
  });
}

ensureSlugFolderWatched('budi-ani');

// Socket.io Connections
io.on('connection', (socket) => {
  const slug = socket.handshake.query?.slug;
  if (typeof slug === 'string' && slug.trim()) {
    socket.join(`event_${slug.trim()}`);
    ensureSlugFolderWatched(slug.trim());
  }

  socket.on('subscribe', (payload) => {
    if (payload?.room) {
      socket.join(payload.room);
      const roomSlug = String(payload.room).replace(/^event_/, '');
      if (roomSlug) ensureSlugFolderWatched(roomSlug);
    }
  });

  socket.on('join_event', (payload) => {
    const targetSlug = typeof payload === 'string' ? payload : payload?.slug;
    if (targetSlug) {
      socket.join(`event_${targetSlug}`);
      ensureSlugFolderWatched(targetSlug);
    }
  });
});

// Status & Helper Endpoints
app.get('/v1/bridge-status', (req, res) => {
  const slug = String(req.query.slug || 'budi-ani');
  ensureSlugFolderWatched(slug);
  res.json({
    online: true,
    local_ip: getLocalIpAddress(),
    ftp_port: FTP_PORT,
    http_port: HTTP_PORT,
    hot_folder: path.join(TEMP_FTP_ROOT, slug),
    active_sessions: activeFtpSessionsBySlug.get(slug) || 0,
  });
});

// Simulate a camera shutter shot (creates a real JPEG in temp-ftp/{slug} and runs the exact pipeline)
app.post('/v1/bridge-test-shot/:slug', async (req, res) => {
  const slug = req.params.slug || 'budi-ani';
  ensureSlugFolderWatched(slug);
  const targetDir = path.join(TEMP_FTP_ROOT, slug);
  const testFile = path.join(targetDir, `DSC_${Date.now().toString().slice(-4)}.jpg`);

  try {
    // Create a crisp test camera shot banner or use sharp to generate a photo
    const svg = `
      <svg width="1600" height="1066" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1c1917"/>
            <stop offset="50%" stop-color="#292524"/>
            <stop offset="100%" stop-color="#0c0a09"/>
          </linearGradient>
        </defs>
        <rect width="1600" height="1066" fill="url(#bg)"/>
        <circle cx="800" cy="533" r="420" fill="none" stroke="#D4AF37" stroke-width="3" stroke-opacity="0.35"/>
        <text x="800" y="450" text-anchor="middle" fill="#D4AF37" font-family="Georgia, serif" font-style="italic" font-size="44">Live Auto-Transfer Shot</text>
        <text x="800" y="545" text-anchor="middle" fill="#ffffff" font-family="Georgia, serif" font-weight="bold" font-size="76">Kamera Fotografer (${slug})</text>
        <text x="800" y="635" text-anchor="middle" fill="#a8a29e" font-family="sans-serif" font-size="32">Otomatis Terkirim Saat Tombol Shutter Ditekan • ${new Date().toLocaleTimeString('id-ID')}</text>
      </svg>
    `;
    await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(testFile);
    await processIncomingCameraFile(slug, testFile);
    res.json({ success: true, message: 'Simulasi jepret kamera berhasil dikirim!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Start FTP Bridge Server
const localIp = getLocalIpAddress();
const ftpServer = new FtpSrv({
  url: `ftp://0.0.0.0:${FTP_PORT}`,
  pasv_url: localIp,
  pasv_min: 50000,
  pasv_max: 50100,
  anonymous: false,
  greeting: ['Welcome to SAVA Live Auto-Upload FTP Bridge'],
});

ftpServer.on('login', ({ connection, username }, resolve) => {
  const slug = String(username || 'budi-ani')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '');

  const eventDir = path.join(TEMP_FTP_ROOT, slug);
  fs.mkdirSync(eventDir, { recursive: true });
  ensureSlugFolderWatched(slug);

  activeFtpSessionsBySlug.set(
    slug,
    (activeFtpSessionsBySlug.get(slug) || 0) + 1,
  );

  connection.on('STOR', (error, filePath) => {
    if (!error && filePath) {
      void processIncomingCameraFile(slug, filePath);
    }
  });

  connection.on('close', () => {
    const prev = activeFtpSessionsBySlug.get(slug) || 1;
    activeFtpSessionsBySlug.set(slug, Math.max(0, prev - 1));
  });

  resolve({ root: eventDir });
});

server.listen(HTTP_PORT, '0.0.0.0', async () => {
  console.log(`[LIVE-CAMERA] WebSocket & Bridge API listening on http://${localIp}:${HTTP_PORT}`);
  try {
    await ftpServer.listen();
    console.log(`[LIVE-CAMERA] FTP Auto-Upload Server listening on ftp://${localIp}:${FTP_PORT}`);
    console.log(`[LIVE-CAMERA] USB Tether Hot-Folder ready at: ${TEMP_FTP_ROOT}`);
  } catch (err) {
    console.error('[LIVE-CAMERA] FTP Server failed to bind port:', err.message);
  }
});

