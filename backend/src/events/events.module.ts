import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminEventsController } from './admin-events.controller';
import { Event } from './entities/event.entity';
import { FtpCredential } from './entities/ftp-credential.entity';
import { Photo } from './entities/photo.entity';
import { EventsService } from './events.service';
import { PublicEventsController } from './public-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event, FtpCredential, Photo])],
  controllers: [AdminEventsController, PublicEventsController],
  providers: [EventsService],
  exports: [EventsService, TypeOrmModule],
})
export class EventsModule {}

