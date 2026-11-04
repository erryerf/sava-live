import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/entities/event.entity';
import { Photo } from '../events/entities/photo.entity';
import { ArchiveProcessor } from './archive.processor';
import { PhotoProcessingProcessor } from './photo-processing.processor';
import { ARCHIVE_QUEUE, PHOTO_PROCESSING_QUEUE } from './queue.constants';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Photo]),
    BullModule.registerQueue(
      {
        name: PHOTO_PROCESSING_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: false, // Keep failed jobs in DLQ so temp file can be retried manually
        },
      },
      {
        name: ARCHIVE_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          removeOnComplete: 50,
          removeOnFail: false,
        },
      },
    ),
  ],
  providers: [PhotoProcessingProcessor, ArchiveProcessor],
  exports: [BullModule, PhotoProcessingProcessor, ArchiveProcessor],
})
export class QueuesModule {}

