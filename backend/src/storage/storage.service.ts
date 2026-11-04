import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly cdnBaseUrl: string;
  private readonly defaultExpiresIn: number;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID', '');
    const configuredEndpoint = this.configService.get<string>('R2_ENDPOINT');
    const endpoint =
      configuredEndpoint ||
      (accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : 'https://r2.cloudflarestorage.com');

    const accessKeyId = this.configService.get<string>(
      'R2_ACCESS_KEY_ID',
      'placeholder-access-key',
    );
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
      'placeholder-secret-key',
    );

    this.bucketName = this.configService.get<string>(
      'R2_BUCKET_NAME',
      'sava-live-bucket',
    );
    this.cdnBaseUrl = this.configService
      .get<string>('CDN_BASE_URL', 'https://cdn.domainanda.com')
      .replace(/\/+$/, '');
    this.defaultExpiresIn = parseInt(
      this.configService.get<string>('R2_PRESIGNED_EXPIRES_IN', '300'),
      10,
    );

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  sanitizeFilename(filename: string): string {
    const cleaned = filename
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_');
    return cleaned || 'photo.jpg';
  }

  buildEventFileKey(
    eventSlug: string,
    source: 'photographer' | 'guest' | 'frames' | 'headers' | 'archives',
    filename: string,
    prefixTimestamp = true,
  ): string {
    const safeName = this.sanitizeFilename(filename);
    const finalName = prefixTimestamp ? `${Date.now()}-${safeName}` : safeName;
    return `events/${eventSlug}/${source}/${finalName}`;
  }

  getPublicCdnUrl(fileKey: string | null | undefined): string | null {
    if (!fileKey) return null;
    const normalizedKey = fileKey.replace(/^\/+/, '');
    return `${this.cdnBaseUrl}/${normalizedKey}`;
  }

  async createPresignedPutUrl(
    fileKey: string,
    contentType: string,
    expiresInSeconds = this.defaultExpiresIn,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async uploadBuffer(
    fileKey: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: body,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    this.logger.log(`Uploaded object to R2: ${fileKey}`);
    return fileKey;
  }

  async getObjectStream(fileKey: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });
    const response = await this.s3Client.send(command);
    return response.Body as Readable;
  }

  async deleteObject(fileKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });
    await this.s3Client.send(command);
    this.logger.log(`Deleted object from R2: ${fileKey}`);
  }
}

