import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EventStatus } from '../../database/enums/database.enums';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  header_subtitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  headerSubtitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung (-).',
  })
  slug?: string;

  @IsOptional()
  @IsDateString()
  start_time?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  end_time?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  theme_color?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  themeColor?: string;

  @IsOptional()
  @IsString()
  header_image_key?: string | null;

  @IsOptional()
  @IsString()
  headerImageKey?: string | null;

  @IsOptional()
  @IsString()
  custom_frame_key?: string | null;

  @IsOptional()
  @IsString()
  customFrameKey?: string | null;

  @IsOptional()
  @IsBoolean()
  require_guest_moderation?: boolean;

  @IsOptional()
  @IsBoolean()
  requireGuestModeration?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  guest_upload_limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  guestUploadLimit?: number;
}

