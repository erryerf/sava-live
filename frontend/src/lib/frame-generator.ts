/**
 * Utility to generate default high-resolution transparent Polaroid frames (.PNG)
 * with customizable couple names and event date.
 */

export interface PolaroidFrameOptions {
  names: string;
  date: string;
  fontFamily?: string;
}

export async function generatePolaroidFrameBlob(
  options: PolaroidFrameOptions,
): Promise<Blob> {
  const { names, date } = options;
  const width = 1500;
  const height = 2100;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak didukung.');

  // Wait for Google font if loaded
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('120px "Alex Brush"'),
          document.fonts.load('120px "Dancing Script"'),
          document.fonts.load('120px "Great Vibes"'),
          document.fonts.ready,
        ]),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
    } catch {
      // Fallback gracefully
    }
  }

  // 1. Clear transparent background
  ctx.clearRect(0, 0, width, height);

  // 2. Draw solid Polaroid paper border
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 3. Cut out the transparent photo window in the middle
  // Top: 70px, Left: 70px, Right: 70px, Bottom chin: 450px
  const marginSide = 72;
  const marginTop = 72;
  const windowW = width - marginSide * 2; // 1356px
  const windowH = 1560; // Leaves ~468px for the chin

  ctx.clearRect(marginSide, marginTop, windowW, windowH);

  // 4. Subtle inner border around the photo cutout for authentic photographic edge
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.09)';
  ctx.lineWidth = 2;
  ctx.strokeRect(marginSide, marginTop, windowW, windowH);

  // 5. Render Couple / Event Name in elegant script typography
  const cleanNames = names.trim() || 'Nama Pasangan';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#141412';

  // Dynamic font sizing if name is very long
  const nameFontSize = cleanNames.length > 28 ? 85 : cleanNames.length > 20 ? 100 : 118;
  ctx.font = `italic ${nameFontSize}px "Alex Brush", "Dancing Script", "Great Vibes", cursive`;

  const chinCenterY = marginTop + windowH + (height - (marginTop + windowH)) / 2;
  // Position names slightly above the chin center
  const namesY = chinCenterY - 38;
  ctx.fillText(cleanNames, width / 2, namesY);

  // 6. Render Event Date in clean modern sans-serif
  const cleanDate = date.trim();
  if (cleanDate) {
    ctx.fillStyle = '#2A2A28';
    ctx.font = '600 42px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    const dateY = namesY + 92;
    ctx.fillText(cleanDate, width / 2, dateY);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Gagal menghasilkan blob PNG bingkai.'));
      },
      'image/png',
      1.0,
    );
  });
}

export async function generatePolaroidFrameFile(
  options: PolaroidFrameOptions,
  filename: string = 'polaroid-default-frame.png',
): Promise<File> {
  const blob = await generatePolaroidFrameBlob(options);
  return new File([blob], filename, { type: 'image/png' });
}

export async function generatePolaroidDataUrl(
  options: PolaroidFrameOptions,
): Promise<string> {
  const blob = await generatePolaroidFrameBlob(options);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadImage(src: File | string): Promise<HTMLImageElement> {
  if (typeof src === 'string') {
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Gagal memuat gambar'));
        img.src = src;
      });
    }

    // Fetch as blob to prevent tainted canvas issues
    try {
      const res = await fetch(src, { mode: 'cors' });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(blobUrl);
            resolve(img);
          };
          img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error('Gagal memuat blob gambar'));
          };
          img.src = blobUrl;
        });
      }
    } catch {
      // Fallback to crossOrigin img tag
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.src = src;
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Gagal memuat file'));
        img.src = reader.result;
      } else {
        reject(new Error('Gagal membaca file foto'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(src);
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const imgW = img.naturalWidth || img.width || 1;
  const imgH = img.naturalHeight || img.height || 1;
  const imgAspect = imgW / imgH;
  const targetAspect = w / h;

  let sx = 0;
  let sy = 0;
  let sw = imgW;
  let sh = imgH;

  if (imgAspect > targetAspect) {
    sw = imgH * targetAspect;
    sx = (imgW - sw) / 2;
  } else {
    sh = imgW / targetAspect;
    sy = (imgH - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export async function compositePhotoWithFrame(
  photoSource: File | string,
  frameUrlOrDataUrl: string,
): Promise<string> {
  if (!frameUrlOrDataUrl) {
    if (typeof photoSource === 'string') return photoSource;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(photoSource);
    });
  }

  const [photoImg, frameImg] = await Promise.all([
    loadImage(photoSource),
    loadImage(frameUrlOrDataUrl),
  ]);

  const canvas = document.createElement('canvas');
  const width = frameImg.naturalWidth || frameImg.width || 1500;
  const height = frameImg.naturalHeight || frameImg.height || 2100;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak didukung.');

  // 1. Fill white canvas
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 2. Polaroid window coordinates
  const windowX = Math.round(width * 0.048);
  const windowY = Math.round(height * 0.0343);
  const windowW = width - windowX * 2;
  const windowH = Math.round(height * 0.7428);

  // 3. Draw photo with cover-fit inside the window
  drawImageCover(ctx, photoImg, windowX, windowY, windowW, windowH);

  // 4. Draw frame on top
  ctx.drawImage(frameImg, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function compositePhotoWithFrameFile(
  photoSource: File | string,
  frameUrlOrDataUrl: string,
  filename: string = 'framed-photo.jpg',
): Promise<File> {
  const dataUrl = await compositePhotoWithFrame(photoSource, frameUrlOrDataUrl);
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: 'image/jpeg' });
}

