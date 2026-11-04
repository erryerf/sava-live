import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PhotoSource } from '../../database/enums/database.enums';

export class GetPhotosQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsEnum(PhotoSource)
  source?: PhotoSource;
}

