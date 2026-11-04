import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as archiver from 'archiver';
import { Job } from 'bullmq';
import * as path from 'path';
import { PassThrough } from 'stream';
import { Repository } from 'typeorm';
import {
  ArchiveStatus,
  PhotoSource,
  PhotoStatus,
} from '../database/enums/database.enums';
import { Event } from '../events/entities/event.entity';
import { Photo } from '../events/entities/photo.entity';
import { StorageService } from '../storage/storage.service';
import { ARCHIVE_QUEUE, ArchiveJobPayload } from './queue.constants';

@Injectable()
@Processor(ARCHIVE_QUEUE, { concurrency: 2 })
export class ArchiveProcessor extends WorkerHost {
  private readonly logger = new Logger(ArchiveProcessor.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(Photo)
    private readonly photosRepository: Repository<Photo>,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<ArchiveJobPayload>): Promise<{ archiveZipKey: string }> {
    const { event_id, slug } = job.data;
    this.logger.log(`Starting ZIP archive generation for event: ${slug} (${event_id})`);

    await this.eventsRepository.update(event_id, {
      archiveStatus: ArchiveStatus.PROCESSING,
    });

    try {
      const photos = await this.photosRepository.find({
        where: {
          eventId: event_id,
          status: PhotoStatus.APPROVED,
        },
        order: { createdAt: 'ASC' },
      });

      const archive = archiver('zip', { zlib: { level: 6 } });
      const passThrough = new PassThrough();
      const chunks: Buffer[] = [];

      passThrough.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      const archiveFinished = new Promise<Buffer>((resolve, reject) => {
        passThrough.on('end', () => resolve(Buffer.concat(chunks)));
        passThrough.on('error', reject);
        archive.on('error', reject);
      });

      archive.pipe(passThrough);

      for (const photo of photos) {
        const keyToDownload = photo.framedFileKey || photo.originalFileKey;
        const folderName =
          photo.source === PhotoSource.PHOTOGRAPHER ? 'Utama' : 'Tamu';
        const fileName = path.basename(keyToDownload);

        try {
          const objStream =
            await this.storageService.getObjectStream(keyToDownload);
          archive.append(objStream, { name: `${folderName}/${fileName}` });
        } catch (streamErr) {
          this.logger.warn(
            `Could not append ${keyToDownload} to archive: ${(streamErr as Error).message}`,
          );
        }
      }

      await archive.finalize();
      const zipBuffer = await archiveFinished;

      const archiveZipKey = `events/${slug}/archives/${slug}-all.zip`;
      await this.storageService.uploadBuffer(
        archiveZipKey,
        zipBuffer,
        'application/zip',
      );

      await this.eventsRepository.update(event_id, {
        archiveZipKey,
        archiveStatus: ArchiveStatus.READY,
      });

      this.logger.log(`Archive ready for event ${slug}: ${archiveZipKey}`);
      return { archiveZipKey };
    } catch (error) {
      this.logger.error(
        `Archive generation failed for event ${slug}: ${(error as Error).message}`,
      );
      await this.eventsRepository.update(event_id, {
        archiveStatus: ArchiveStatus.FAILED,
      });
      throw error;
    }
  }
}

