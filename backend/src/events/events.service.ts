import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import {
  ArchiveStatus,
  EventStatus,
  PhotoSource,
  PhotoStatus,
} from '../database/enums/database.enums';
import { FtpBridgeService } from '../ftp/ftp-bridge.service';
import {
  ARCHIVE_QUEUE,
  ArchiveJobPayload,
  PHOTO_PROCESSING_QUEUE,
  PhotoProcessingJobPayload,
} from '../queues/queue.constants';
import { LiveGalleryGateway } from '../realtime/live-gallery.gateway';
import { StorageService } from '../storage/storage.service';
import { ConfirmPhotoUploadDto } from './dto/confirm-photo.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { GetPhotosQueryDto } from './dto/get-photos-query.dto';
import { CreatePresignedUrlDto } from './dto/presigned-url.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from './entities/event.entity';
import { FtpCredential } from './entities/ftp-credential.entity';
import { Photo } from './entities/photo.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(FtpCredential)
    private readonly ftpCredentialsRepository: Repository<FtpCredential>,
    @InjectRepository(Photo)
    private readonly photosRepository: Repository<Photo>,
    private readonly storageService: StorageService,
    private readonly ftpBridgeService: FtpBridgeService,
    private readonly liveGalleryGateway: LiveGalleryGateway,
    @InjectQueue(PHOTO_PROCESSING_QUEUE)
    private readonly photoProcessingQueue: Queue<PhotoProcessingJobPayload>,
    @InjectQueue(ARCHIVE_QUEUE)
    private readonly archiveQueue: Queue<ArchiveJobPayload>,
  ) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private generateFtpPassword(): string {
    return randomBytes(4).toString('hex');
  }

  private serializeEvent(event: Event, plainFtpPassword?: string) {
    const isUploadAllowed = event.status === EventStatus.ACTIVE;
    const ftpStatus = this.ftpBridgeService.getEventFtpStatus(event.slug);

    return {
      id: event.id,
      name: event.name,
      header_subtitle: event.headerSubtitle ?? 'The Wedding of',
      slug: event.slug,
      start_time: event.startTime,
      end_time: event.endTime,
      status: event.status,
      theme_color: event.themeColor,
      header_image_key: event.headerImageKey,
      header_image_url: this.storageService.getPublicCdnUrl(
        event.headerImageKey,
      ),
      custom_frame_key: event.customFrameKey,
      custom_frame_url: this.storageService.getPublicCdnUrl(
        event.customFrameKey,
      ),
      require_guest_moderation: event.requireGuestModeration,
      guest_upload_limit: event.guestUploadLimit,
      is_upload_allowed: isUploadAllowed,
      archive_zip_key: event.archiveZipKey,
      archive_download_url: this.storageService.getPublicCdnUrl(
        event.archiveZipKey,
      ),
      archive_status: event.archiveStatus,
      created_by: event.createdBy,
      created_at: event.createdAt,
      updated_at: event.updatedAt,
      ftp_status: ftpStatus,
      ftp_credentials: event.ftpCredential
        ? {
            id: event.ftpCredential.id,
            username: event.ftpCredential.username,
            ...(plainFtpPassword ? { password: plainFtpPassword } : {}),
            is_active: event.ftpCredential.isActive,
            created_at: event.ftpCredential.createdAt,
          }
        : undefined,
    };
  }

  public serializePhoto(photo: Photo) {
    const activeKey = photo.framedFileKey || photo.originalFileKey;
    return {
      id: photo.id,
      url: this.storageService.getPublicCdnUrl(activeKey),
      original_url: this.storageService.getPublicCdnUrl(photo.originalFileKey),
      source: photo.source,
      guest_name: photo.guestName ?? null,
      status: photo.status,
      created_at: photo.createdAt.toISOString(),
    };
  }

  async create(dto: CreateEventDto) {
    const slug = (dto.slug || this.slugify(dto.name)).slice(0, 50);
    if (!slug) {
      throw new BadRequestException('Slug acara tidak valid.');
    }

    const existing = await this.eventsRepository.findOne({
      where: { slug },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(`Slug "${slug}" sudah digunakan.`);
    }

    const startTimeStr = dto.start_time ?? dto.startTime;
    const endTimeStr = dto.end_time ?? dto.endTime;

    if (!startTimeStr || !endTimeStr) {
      throw new BadRequestException('start_time dan end_time wajib diisi.');
    }

    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);

    if (endTime <= startTime) {
      throw new BadRequestException(
        'end_time harus lebih besar dari start_time.',
      );
    }

    const plainFtpPassword = dto.ftp_password || this.generateFtpPassword();
    const passwordHash = await bcrypt.hash(plainFtpPassword, 10);

    const event = this.eventsRepository.create({
      name: dto.name,
      headerSubtitle:
        dto.header_subtitle !== undefined
          ? dto.header_subtitle
          : dto.headerSubtitle !== undefined
            ? dto.headerSubtitle
            : 'The Wedding of',
      slug,
      startTime,
      endTime,
      status: dto.status ?? EventStatus.ACTIVE,
      themeColor: dto.theme_color ?? dto.themeColor ?? '#000000',
      headerImageKey: dto.header_image_key ?? dto.headerImageKey ?? null,
      customFrameKey: dto.custom_frame_key ?? dto.customFrameKey ?? null,
      requireGuestModeration:
        dto.require_guest_moderation ?? dto.requireGuestModeration ?? false,
      guestUploadLimit: dto.guest_upload_limit ?? dto.guestUploadLimit ?? 5,
      createdBy: dto.created_by ?? dto.createdBy ?? null,
    });

    const savedEvent = await this.eventsRepository.save(event);

    const ftpCredential = this.ftpCredentialsRepository.create({
      eventId: savedEvent.id,
      username: slug,
      passwordHash,
      isActive: savedEvent.status !== EventStatus.ARCHIVED,
    });

    savedEvent.ftpCredential =
      await this.ftpCredentialsRepository.save(ftpCredential);

    return this.serializeEvent(savedEvent, plainFtpPassword);
  }

  async findAll(status?: EventStatus) {
    const where = status ? { status } : {};
    const events = await this.eventsRepository.find({
      where,
      relations: ['ftpCredential'],
      order: { createdAt: 'DESC' },
    });

    return events.map((event) => this.serializeEvent(event));
  }

  async findOneById(id: string) {
    const event = await this.eventsRepository.findOne({
      where: { id },
      relations: ['ftpCredential'],
    });

    if (!event) {
      throw new NotFoundException('Event tidak ditemukan.');
    }

    return this.serializeEvent(event);
  }

  async findEntityBySlug(slug: string): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { slug },
    });

    if (!event) {
      throw new NotFoundException('Acara tidak ditemukan.');
    }

    return event;
  }

  async findPublicBySlug(slug: string) {
    const event = await this.findEntityBySlug(slug);

    return {
      id: event.id,
      name: event.name,
      header_subtitle: event.headerSubtitle ?? 'The Wedding of',
      slug: event.slug,
      status: event.status,
      theme_color: event.themeColor,
      header_image_url: this.storageService.getPublicCdnUrl(
        event.headerImageKey,
      ),
      guest_upload_limit: event.guestUploadLimit,
      is_upload_allowed: event.status === EventStatus.ACTIVE,
    };
  }

  async getEventPhotos(slug: string, query: GetPhotosQueryDto) {
    const event = await this.findEntityBySlug(slug);
    const limit = query.limit ?? 30;

    const whereClause: Record<string, unknown> = {
      eventId: event.id,
      status: PhotoStatus.APPROVED,
    };

    if (query.source) {
      whereClause.source = query.source;
    }

    if (query.cursor) {
      const cursorDate = new Date(query.cursor);
      if (isNaN(cursorDate.getTime())) {
        throw new BadRequestException('Format cursor waktu tidak valid.');
      }
      whereClause.createdAt = LessThan(cursorDate);
    }

    const photos = await this.photosRepository.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });

    const hasMore = photos.length > limit;
    const items = hasMore ? photos.slice(0, limit) : photos;
    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1].createdAt.toISOString()
        : null;

    return {
      meta: {
        next_cursor: nextCursor,
        has_more: hasMore,
      },
      data: items.map((photo) => ({
        id: photo.id,
        url: this.storageService.getPublicCdnUrl(
          photo.framedFileKey || photo.originalFileKey,
        ),
        source: photo.source,
        guest_name: photo.guestName ?? null,
        created_at: photo.createdAt.toISOString(),
      })),
    };
  }

  private async ensureGuestCanUpload(event: Event, guestIdentifier: string) {
    if (event.status !== EventStatus.ACTIVE) {
      throw new ForbiddenException('Sesi unggah foto sudah ditutup.');
    }

    const currentCount = await this.photosRepository.count({
      where: {
        eventId: event.id,
        source: PhotoSource.GUEST,
        guestIdentifier,
      },
    });

    if (currentCount >= event.guestUploadLimit) {
      throw new ForbiddenException(
        `Batas upload (${event.guestUploadLimit}/${event.guestUploadLimit}) penuh. Nikmati acaranya! 🎉`,
      );
    }
  }

  async createGuestPresignedUrl(slug: string, dto: CreatePresignedUrlDto) {
    const event = await this.findEntityBySlug(slug);
    await this.ensureGuestCanUpload(event, dto.guest_identifier);

    const fileKey = this.storageService.buildEventFileKey(
      event.slug,
      'guest',
      dto.filename,
      true,
    );

    const uploadUrl = await this.storageService.createPresignedPutUrl(
      fileKey,
      dto.content_type,
    );

    return {
      upload_url: uploadUrl,
      file_key: fileKey,
    };
  }

  async confirmGuestPhotoUpload(slug: string, dto: ConfirmPhotoUploadDto) {
    const event = await this.findEntityBySlug(slug);
    await this.ensureGuestCanUpload(event, dto.guest_identifier);

    const expectedPrefix = `events/${event.slug}/guest/`;
    if (!dto.file_key.startsWith(expectedPrefix)) {
      throw new BadRequestException(
        `file_key tidak valid. Harus berada di jalur ${expectedPrefix}`,
      );
    }

    const initialStatus = event.requireGuestModeration
      ? PhotoStatus.PENDING
      : PhotoStatus.APPROVED;

    const photo = this.photosRepository.create({
      eventId: event.id,
      originalFileKey: dto.file_key,
      framedFileKey: null,
      source: PhotoSource.GUEST,
      guestIdentifier: dto.guest_identifier,
      guestName: dto.guest_name?.trim() || null,
      status: initialStatus,
    });

    const savedPhoto = await this.photosRepository.save(photo);

    await this.photoProcessingQueue.add('guest-photo', {
      jobType: 'guest_upload',
      eventSlug: event.slug,
      photoId: savedPhoto.id,
      fileKey: dto.file_key,
      guestName: savedPhoto.guestName,
    });

    return {
      photoId: savedPhoto.id,
      status: savedPhoto.status,
    };
  }

  async getEventArchiveStatus(slug: string) {
    const event = await this.findEntityBySlug(slug);

    return {
      status: event.archiveStatus,
      download_url: event.archiveZipKey
        ? this.storageService.getPublicCdnUrl(event.archiveZipKey)
        : null,
    };
  }

  async triggerArchiveGeneration(id: string) {
    const event = await this.eventsRepository.findOne({
      where: { id },
      relations: ['ftpCredential'],
    });

    if (!event) {
      throw new NotFoundException('Event tidak ditemukan.');
    }

    event.archiveStatus = ArchiveStatus.PROCESSING;
    await this.eventsRepository.save(event);

    await this.archiveQueue.add('generate-zip', {
      event_id: event.id,
      slug: event.slug,
    });
  }

  async findAllPhotosForAdmin(
    eventId: string,
    source?: PhotoSource,
    status?: PhotoStatus,
  ) {
    const event = await this.eventsRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event tidak ditemukan.');
    }

    const where: Record<string, unknown> = { eventId };
    if (source) where.source = source;
    if (status) where.status = status;

    const photos = await this.photosRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    return photos.map((photo) => this.serializePhoto(photo));
  }

  async moderatePhoto(
    eventId: string,
    photoId: string,
    status: PhotoStatus,
  ) {
    const event = await this.eventsRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event tidak ditemukan.');
    }

    const photo = await this.photosRepository.findOne({
      where: { id: photoId, eventId },
    });
    if (!photo) {
      throw new NotFoundException('Foto tidak ditemukan.');
    }

    const previousStatus = photo.status;
    photo.status = status;
    const saved = await this.photosRepository.save(photo);

    if (
      status === PhotoStatus.APPROVED &&
      previousStatus !== PhotoStatus.APPROVED
    ) {
      await this.liveGalleryGateway.broadcastNewPhoto(event.slug, {
        id: saved.id,
        url: this.storageService.getPublicCdnUrl(
          saved.framedFileKey || saved.originalFileKey,
        ),
        source: saved.source,
        guest_name: saved.guestName ?? null,
        created_at: saved.createdAt.toISOString(),
      });
    } else if (status === PhotoStatus.REJECTED) {
      await this.liveGalleryGateway.broadcastPhotoDeleted(event.slug, saved.id);
    }

    return this.serializePhoto(saved);
  }

  async deletePhotoForAdmin(eventId: string, photoId: string) {
    const event = await this.eventsRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event tidak ditemukan.');
    }

    const photo = await this.photosRepository.findOne({
      where: { id: photoId, eventId },
    });
    if (!photo) {
      throw new NotFoundException('Foto tidak ditemukan.');
    }

    await this.photosRepository.remove(photo);

    try {
      await this.storageService.deleteObject(photo.originalFileKey);
      if (photo.framedFileKey) {
        await this.storageService.deleteObject(photo.framedFileKey);
      }
    } catch {
      // Ignore R2 delete error if bucket is not connected locally
    }

    await this.liveGalleryGateway.broadcastPhotoDeleted(event.slug, photoId);
  }

  async createAdminHeaderPresignedUrl(
    id: string,
    filename: string,
    contentType = 'image/jpeg',
  ) {
    const event = await this.eventsRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event tidak ditemukan.');
    }

    const fileKey = this.storageService.buildEventFileKey(
      event.slug,
      'headers',
      filename,
      true,
    );

    const uploadUrl = await this.storageService.createPresignedPutUrl(
      fileKey,
      contentType,
    );

    return {
      upload_url: uploadUrl,
      file_key: fileKey,
      public_url: this.storageService.getPublicCdnUrl(fileKey),
    };
  }

  async createAdminFramePresignedUrl(
    id: string,
    filename: string,
    contentType = 'image/png',
  ) {
    const event = await this.eventsRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event tidak ditemukan.');
    }

    const fileKey = this.storageService.buildEventFileKey(
      event.slug,
      'frames',
      filename,
      true,
    );

    const uploadUrl = await this.storageService.createPresignedPutUrl(
      fileKey,
      contentType,
    );

    return {
      upload_url: uploadUrl,
      file_key: fileKey,
      public_url: this.storageService.getPublicCdnUrl(fileKey),
    };
  }

  async update(id: string, dto: UpdateEventDto) {
    const event = await this.eventsRepository.findOne({
      where: { id },
      relations: ['ftpCredential'],
    });

    if (!event) {
      throw new NotFoundException('Event tidak ditemukan.');
    }

    if (dto.slug && dto.slug !== event.slug) {
      const existing = await this.eventsRepository.findOne({
        where: { slug: dto.slug },
        withDeleted: true,
      });
      if (existing) {
        throw new ConflictException(`Slug "${dto.slug}" sudah digunakan.`);
      }
      event.slug = dto.slug;
      if (event.ftpCredential) {
        event.ftpCredential.username = dto.slug.slice(0, 50);
        await this.ftpCredentialsRepository.save(event.ftpCredential);
      }
    }

    if (dto.name !== undefined) event.name = dto.name;

    const headerSubtitle =
      dto.header_subtitle !== undefined
        ? dto.header_subtitle
        : dto.headerSubtitle;
    if (headerSubtitle !== undefined) event.headerSubtitle = headerSubtitle;

    const startTimeStr = dto.start_time ?? dto.startTime;
    const endTimeStr = dto.end_time ?? dto.endTime;
    if (startTimeStr !== undefined) event.startTime = new Date(startTimeStr);
    if (endTimeStr !== undefined) event.endTime = new Date(endTimeStr);

    if (event.endTime <= event.startTime) {
      throw new BadRequestException(
        'end_time harus lebih besar dari start_time.',
      );
    }

    if (dto.status !== undefined) {
      event.status = dto.status;
      if (event.ftpCredential) {
        event.ftpCredential.isActive = dto.status !== EventStatus.ARCHIVED;
        await this.ftpCredentialsRepository.save(event.ftpCredential);
      }
    }

    const themeColor = dto.theme_color ?? dto.themeColor;
    if (themeColor !== undefined) event.themeColor = themeColor;

    const headerImageKey =
      dto.header_image_key !== undefined
        ? dto.header_image_key
        : dto.headerImageKey;
    if (headerImageKey !== undefined) event.headerImageKey = headerImageKey;

    const customFrameKey =
      dto.custom_frame_key !== undefined
        ? dto.custom_frame_key
        : dto.customFrameKey;
    if (customFrameKey !== undefined) event.customFrameKey = customFrameKey;

    const requireGuestModeration =
      dto.require_guest_moderation ?? dto.requireGuestModeration;
    if (requireGuestModeration !== undefined) {
      event.requireGuestModeration = requireGuestModeration;
    }

    const guestUploadLimit = dto.guest_upload_limit ?? dto.guestUploadLimit;
    if (guestUploadLimit !== undefined) {
      event.guestUploadLimit = guestUploadLimit;
    }

    const saved = await this.eventsRepository.save(event);
    return this.serializeEvent(saved);
  }

  async updateStatus(id: string, dto: UpdateEventStatusDto) {
    const event = await this.eventsRepository.findOne({
      where: { id },
      relations: ['ftpCredential'],
    });

    if (!event) {
      throw new NotFoundException('Event tidak ditemukan.');
    }

    event.status = dto.status;

    if (event.ftpCredential) {
      event.ftpCredential.isActive = dto.status !== EventStatus.ARCHIVED;
      await this.ftpCredentialsRepository.save(event.ftpCredential);
    }

    const saved = await this.eventsRepository.save(event);
    await this.liveGalleryGateway.broadcastEventStatusChanged(
      saved.slug,
      saved.status,
    );

    return this.serializeEvent(saved);
  }

  async resetFtpPassword(id: string) {
    const event = await this.eventsRepository.findOne({
      where: { id },
      relations: ['ftpCredential'],
    });

    if (!event || !event.ftpCredential) {
      throw new NotFoundException('Kredensial FTP event tidak ditemukan.');
    }

    const newPlainPassword = this.generateFtpPassword();
    event.ftpCredential.passwordHash = await bcrypt.hash(newPlainPassword, 10);
    await this.ftpCredentialsRepository.save(event.ftpCredential);

    return {
      username: event.ftpCredential.username,
      password: newPlainPassword,
      is_active: event.ftpCredential.isActive,
    };
  }

  async remove(id: string): Promise<void> {
    const event = await this.eventsRepository.findOne({
      where: { id },
      relations: ['ftpCredential'],
    });

    if (!event) {
      throw new NotFoundException('Event tidak ditemukan.');
    }

    if (event.ftpCredential) {
      event.ftpCredential.isActive = false;
      await this.ftpCredentialsRepository.save(event.ftpCredential);
    }

    await this.eventsRepository.softDelete(id);
  }
}
