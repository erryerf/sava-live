import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID =
  process.env.R2_ACCOUNT_ID || '8b46f97e1b2c60db108af041e28fda0e';
const R2_ACCESS_KEY_ID =
  process.env.R2_ACCESS_KEY_ID || 'df0d27694dff0fa8515c3be5b46ecd21';
const R2_SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY ||
  'ec9d40d1dd46fbaad468646c88998341af527bf21431afa02f281622cee54135';
export const R2_BUCKET_NAME =
  process.env.R2_BUCKET_NAME || 'sava-live-gallery';
export const CDN_BASE_URL =
  process.env.CDN_BASE_URL ||
  process.env.NEXT_PUBLIC_CDN_BASE_URL ||
  'https://pub-0cded6573cff41058ef608531431b6ce.r2.dev';

let s3Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

export async function createR2PresignedUploadUrl(
  fileKey: string,
  contentType: string = 'image/jpeg',
  expiresInSeconds: number = 300,
): Promise<string> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileKey,
    ContentType: contentType,
  });

  return await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });
}

export async function getR2ObjectStream(fileKey: string): Promise<{
  body: ReadableStream | null;
  contentType?: string;
  contentLength?: number;
}> {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: fileKey,
  });
  const res = await client.send(command);
  return {
    body: (res.Body?.transformToWebStream() as ReadableStream) || null,
    contentType: res.ContentType,
    contentLength: res.ContentLength,
  };
}

export function getR2PublicUrl(fileKey: string): string {
  const cleanKey = fileKey.replace(/^\/+/, '');
  // If a custom domain is configured (not raw r2.dev which is blocked by Indonesian ISPs), use it
  if (CDN_BASE_URL && !CDN_BASE_URL.includes('.r2.dev')) {
    const cleanBase = CDN_BASE_URL.replace(/\/+$/, '');
    return `${cleanBase}/${cleanKey}`;
  }
  // Otherwise route via app edge proxy with aggressive caching to guarantee 100% reachability across Indonesian ISPs
  return `/v1/photos/asset/${cleanKey}`;
}

