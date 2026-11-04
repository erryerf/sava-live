import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmPhotoUploadDto {
  @IsString()
  @IsNotEmpty()
  file_key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  guest_identifier: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  guest_name?: string;
}

