import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AdminBearerGuard } from '../common/guards/admin-bearer.guard';
import {
  EventStatus,
  PhotoSource,
  PhotoStatus,
} from '../database/enums/database.enums';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

class FramePresignedDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsOptional()
  @IsString()
  content_type?: string;
}

class ModeratePhotoDto {
  @IsEnum(PhotoStatus)
  status: PhotoStatus;
}

@Controller('admin/events')
@UseGuards(AdminBearerGuard)
export class AdminEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  async create(@Body() dto: CreateEventDto) {
    const data = await this.eventsService.create(dto);
    return {
      success: true,
      data,
    };
  }

  @Get()
  async findAll(@Query('status') status?: EventStatus) {
    const data = await this.eventsService.findAll(status);
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.eventsService.findOneById(id);
    return {
      success: true,
      data,
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    const data = await this.eventsService.update(id, dto);
    return {
      success: true,
      data,
    };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventStatusDto,
  ) {
    const data = await this.eventsService.updateStatus(id, dto);
    return {
      success: true,
      data,
    };
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerArchive(@Param('id', ParseUUIDPipe) id: string) {
    await this.eventsService.triggerArchiveGeneration(id);
    return {
      success: true,
      message: 'Pembuatan ZIP dimasukkan ke antrean.',
    };
  }

  @Get(':id/photos')
  async findEventPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('source') source?: PhotoSource,
    @Query('status') status?: PhotoStatus,
  ) {
    const data = await this.eventsService.findAllPhotosForAdmin(
      id,
      source,
      status,
    );
    return {
      success: true,
      data,
    };
  }

  @Patch(':id/photos/:photoId/status')
  async moderatePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Body() dto: ModeratePhotoDto,
  ) {
    const data = await this.eventsService.moderatePhoto(
      id,
      photoId,
      dto.status,
    );
    return {
      success: true,
      data,
    };
  }

  @Delete(':id/photos/:photoId')
  async deletePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    await this.eventsService.deletePhotoForAdmin(id, photoId);
    return {
      success: true,
      message: 'Foto dihapus.',
    };
  }

  @Post(':id/header/presigned-url')
  async createHeaderPresignedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FramePresignedDto,
  ) {
    const data = await this.eventsService.createAdminHeaderPresignedUrl(
      id,
      dto.filename,
      dto.content_type || 'image/jpeg',
    );
    return {
      success: true,
      data,
    };
  }

  @Post(':id/frame/presigned-url')
  async createFramePresignedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FramePresignedDto,
  ) {
    const data = await this.eventsService.createAdminFramePresignedUrl(
      id,
      dto.filename,
      dto.content_type || 'image/png',
    );
    return {
      success: true,
      data,
    };
  }

  @Post(':id/ftp-password/reset')
  async resetFtpPassword(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.eventsService.resetFtpPassword(id);
    return {
      success: true,
      data,
    };
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.eventsService.remove(id);
    return {
      success: true,
      message: 'Event berhasil dihapus.',
    };
  }
}
