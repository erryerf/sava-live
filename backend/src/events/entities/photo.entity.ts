import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PhotoSource, PhotoStatus } from '../../database/enums/database.enums';
import { Event } from './event.entity';

@Entity('photos')
@Index('idx_photos_event_id_created_at', ['eventId', 'createdAt'])
@Index('idx_photos_status', ['status'])
export class Photo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event, (event) => event.photos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ name: 'original_file_key', type: 'text' })
  originalFileKey: string;

  @Column({ name: 'framed_file_key', type: 'text', nullable: true })
  framedFileKey: string | null;

  @Column({
    type: 'enum',
    enum: PhotoSource,
    enumName: 'photo_source',
  })
  source: PhotoSource;

  @Column({ name: 'guest_identifier', type: 'varchar', length: 255, nullable: true })
  guestIdentifier: string | null;

  @Column({ name: 'guest_name', type: 'varchar', length: 100, nullable: true })
  guestName: string | null;

  @Column({
    type: 'enum',
    enum: PhotoStatus,
    enumName: 'photo_status',
    default: PhotoStatus.APPROVED,
  })
  status: PhotoStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

