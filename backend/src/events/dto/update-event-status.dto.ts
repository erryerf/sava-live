import { IsEnum } from 'class-validator';
import { EventStatus } from '../../database/enums/database.enums';

export class UpdateEventStatusDto {
  @IsEnum(EventStatus)
  status: EventStatus;
}

