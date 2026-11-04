import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ConfirmPhotoUploadDto } from './dto/confirm-photo.dto';
import { GetPhotosQueryDto } from './dto/get-photos-query.dto';
import { CreatePresignedUrlDto } from './dto/presigned-url.dto';
import { EventsService } from './events.service';

@Controller('events')
export class PublicEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get(':slug')
  async getEventBySlug(@Param('slug') slug: string) {
    const data = await this.eventsService.findPublicBySlug(slug);
    return {
      success: true,
      data,
    };
  }

  @Get(':slug/photos')
  async getEventPhotos(
    @Param('slug') slug: string,
    @Query() query: GetPhotosQueryDto,
  ) {
    const result = await this.eventsService.getEventPhotos(slug, query);
    return {
      success: true,
      meta: result.meta,
      data: result.data,
    };
  }

  @Post(':slug/photos/presigned-url')
  @HttpCode(HttpStatus.OK)
  async createPresignedUrl(
    @Param('slug') slug: string,
    @Body() dto: CreatePresignedUrlDto,
  ) {
    const data = await this.eventsService.createGuestPresignedUrl(slug, dto);
    return {
      success: true,
      data,
    };
  }

  @Post(':slug/photos/confirm')
  @HttpCode(HttpStatus.ACCEPTED)
  async confirmPhotoUpload(
    @Param('slug') slug: string,
    @Body() dto: ConfirmPhotoUploadDto,
  ) {
    await this.eventsService.confirmGuestPhotoUpload(slug, dto);
    return {
      success: true,
      message: 'Foto sedang diproses dan akan segera tayang.',
    };
  }

  @Get(':slug/archive')
  async getEventArchive(@Param('slug') slug: string) {
    const data = await this.eventsService.getEventArchiveStatus(slug);
    return {
      success: true,
      data,
    };
  }
}
