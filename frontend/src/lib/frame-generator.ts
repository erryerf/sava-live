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
