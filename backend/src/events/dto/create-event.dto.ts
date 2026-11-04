import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EventStatus } from '../../database/enums/database.enums';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  header_subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  headerSubtitle?: string;

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
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'theme_color harus berupa kode Hex 6 digit (contoh: #D4AF37).',
  })
  theme_color?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  themeColor?: string;

  @IsOptional()
  @IsString()
  header_image_key?: string;

  @IsOptional()
  @IsString()
  headerImageKey?: string;

  @IsOptional()
  @IsString()
  custom_frame_key?: string;

  @IsOptional()
  @IsString()
  customFrameKey?: string;

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

  @IsOptional()
  @IsUUID()
  created_by?: string;

  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @IsOptional()
  @IsString()
  ftp_password?: string;
}

