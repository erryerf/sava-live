import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export class CreatePresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_IMAGE_MIME_TYPES, {
    message: 'Format file tidak didukung. Gunakan JPG, PNG, atau WebP.',
  })
  content_type: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  guest_identifier: string;
}

