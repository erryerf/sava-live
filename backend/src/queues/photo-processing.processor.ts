import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';
import { Readable } from 'stream';
import { Repository } from 'typeorm';
import {
  PhotoSource,
  PhotoStatus,
} from '../database/enums/database.enums';
import { Event } from '../events/entities/event.entity';
import { Photo } from '../events/entities/photo.entity';
import { StorageService } from '../storage/storage.service';
import {
  FtpPhotoJobPayload,
  GuestPhotoJobPayload,
  NewPhotoBroadcastPayload,
  PHOTO_PROCESSING_QUEUE,
  PhotoProcessingJobPayload,
} from './queue.constants';

export type PhotoBroadcastCallback = (
  eventSlug: string,
  payload: NewPhotoBroadcastPayload,
) => void | Promise<void>;

@Injectable()
@Processor(PHOTO_PROCESSING_QUEUE, { concurrency: 5 })
export class PhotoProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(PhotoProcessingProcessor.name);
  private broadcastCallbacks: PhotoBroadcastCallback[] = [];

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(Photo)
    private readonly photosRepository: Repository<Photo>,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  registerBroadcastCallback(cb: PhotoBroadcastCallback) {
    this.broadcastCallbacks.push(cb);
  }

  private async notifyBroadcastListeners(
    eventSlug: string,
    payload: NewPhotoBroadcastPayload,
  ) {
    for (const cb of this.broadcastCallbacks) {
      try {
        await cb(eventSlug, payload);
      } catch (err) {
        this.logger.error(
          `Failed to broadcast NEW_PHOTO for event ${eventSlug}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private async applyCustomFrameIfConfigured(
    photoBuffer: Buffer,
    customFrameKey: string | null,
  ): Promise<Buffer | null> {
    if (!customFrameKey) return null;

    try {
      const frameStream =
        await this.storageService.getObjectStream(customFrameKey);
      const frameRawBuffer = await this.streamToBuffer(frameStream);

      const metadata = await sharp(photoBuffer).metadata();
      const width = metadata.width || 1920;
      const height = metadata.height || 1280;

      const resizedFrameBuffer = await sharp(frameRawBuffer)
        .resize(width, height, { fit: 'fill' })
        .png()
        .toBuffer();

      return await sharp(photoBuffer)
        .composite([{ input: resizedFrameBuffer, top: 0, left: 0 }])
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
    } catch (error) {
      this.logger.warn(
        `Custom frame (${customFrameKey}) could not be applied, falling back to unframed image: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async process(
    job: Job<PhotoProcessingJobPayload>,
  ): Promise<NewPhotoBroadcastPayload | null> {
    const data = job.data;

    if ('jobType' in data && data.jobType === 'guest_upload') {
      return this.processGuestUpload(data);
    }

    return this.processFtpUpload(data as FtpPhotoJobPayload);
  }

  private async processFtpUpload(
    payload: FtpPhotoJobPayload,
  ): Promise<NewPhotoBroadcastPayload | null> {
    const { eventSlug, tempFilePath } = payload;

    const event = await this.eventsRepository.findOne({
      where: { slug: eventSlug },
    });

    if (!event) {
      this.logger.warn(
        `Event "${eventSlug}" not found for FTP file ${tempFilePath}. Skipping.`,
      );
      return null;
    }

    if (!fs.existsSync(tempFilePath)) {
      throw new Error(`Local FTP temp file does not exist: ${tempFilePath}`);
    }

    const rawBuffer = await fs.promises.readFile(tempFilePath);
    const filename = path.basename(tempFilePath);
    const safeFilename = this.storageService.sanitizeFilename(filename);

    // 1. Optimize & auto-orient image using sharp
    const optimizedBuffer = await sharp(rawBuffer)
      .rotate()
      .resize({
        width: 2560,
        height: 2560,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    // 2. Upload original optimized photo to Cloudflare R2: events/{slug}/photographer/{filename}
    const originalFileKey = `events/${event.slug}/photographer/${Date.now()}-${safeFilename}`;
    await this.storageService.uploadBuffer(
      originalFileKey,
      optimizedBuffer,
      'image/jpeg',
    );

    // 3. Apply custom PNG frame if configured on the event
    let framedFileKey: string | null = null;
    const framedBuffer = await this.applyCustomFrameIfConfigured(
      optimizedBuffer,
      event.customFrameKey,
    );
    if (framedBuffer) {
      framedFileKey = `events/${event.slug}/photographer/frame_${Date.now()}-${safeFilename}`;
      await this.storageService.uploadBuffer(
        framedFileKey,
        framedBuffer,
        'image/jpeg',
      );
    }

    // 4. Garbage Collection: delete local temp file once R2 upload succeeds
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        this.logger.log(`Deleted local FTP temp file: ${tempFilePath}`);
      }
    } catch (unlinkError) {
      this.logger.warn(
        `Failed to unlink temp file ${tempFilePath}: ${(unlinkError as Error).message}`,
      );
    }

    // 5. Save photo metadata to PostgreSQL
    const photo = this.photosRepository.create({
      eventId: event.id,
      originalFileKey,
      framedFileKey,
      source: PhotoSource.PHOTOGRAPHER,
      guestIdentifier: null,
      guestName: null,
      status: PhotoStatus.APPROVED,
    });

    const savedPhoto = await this.photosRepository.save(photo);

    const broadcastPayload: NewPhotoBroadcastPayload = {
      id: savedPhoto.id,
      url: this.storageService.getPublicCdnUrl(
        savedPhoto.framedFileKey || savedPhoto.originalFileKey,
      ),
      source: PhotoSource.PHOTOGRAPHER,
      guest_name: null,
      created_at: savedPhoto.createdAt.toISOString(),
    };

    // 6. Trigger real-time broadcast listeners (WebSocket / Redis Pub/Sub)
    await this.notifyBroadcastListeners(event.slug, broadcastPayload);

    return broadcastPayload;
  }

  private async processGuestUpload(
    payload: GuestPhotoJobPayload,
  ): Promise<NewPhotoBroadcastPayload | null> {
    const { eventSlug, photoId, fileKey } = payload;

    const event = await this.eventsRepository.findOne({
      where: { slug: eventSlug },
    });
    const photo = await this.photosRepository.findOne({
      where: { id: photoId },
    });

    if (!event || !photo) {
      return null;
    }

    // If custom frame is configured, attempt to composite frame over the guest photo in R2
    if (event.customFrameKey) {
      try {
        const guestPhotoStream =
          await this.storageService.getObjectStream(fileKey);
        const guestBuffer = await this.streamToBuffer(guestPhotoStream);
        const orientedBuffer = await sharp(guestBuffer)
          .rotate()
          .resize({
            width: 2048,
            height: 2048,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 86 })
          .toBuffer();

        const framedBuffer = await this.applyCustomFrameIfConfigured(
          orientedBuffer,
          event.customFrameKey,
        );

        if (framedBuffer) {
          const filename = path.basename(fileKey);
          const framedKey = `events/${event.slug}/guest/frame_${filename}`;
          await this.storageService.uploadBuffer(
            framedKey,
            framedBuffer,
            'image/jpeg',
          );
          photo.framedFileKey = framedKey;
          await this.photosRepository.save(photo);
        }
      } catch (err) {
        this.logger.warn(
          `Guest photo framing skipped for ${fileKey}: ${(err as Error).message}`,
        );
      }
    }

    const broadcastPayload: NewPhotoBroadcastPayload = {
      id: photo.id,
      url: this.storageService.getPublicCdnUrl(
        photo.framedFileKey || photo.originalFileKey,
      ),
      source: PhotoSource.GUEST,
      guest_name: photo.guestName ?? null,
      created_at: photo.createdAt.toISOString(),
    };

    if (photo.status === PhotoStatus.APPROVED) {
      await this.notifyBroadcastListeners(event.slug, broadcastPayload);
    }

    return broadcastPayload;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PhotoProcessingJobPayload> | undefined, error: Error) {
    if (!job) return;
    this.logger.error(
      `Job ${job.id} in ${PHOTO_PROCESSING_QUEUE} failed (attempt ${job.attemptsMade}/${job.opts.attempts ?? 3}): ${error.message}`,
    );
  }
}

