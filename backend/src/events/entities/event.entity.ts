import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ArchiveStatus, EventStatus } from '../../database/enums/database.enums';
import { User } from '../../users/entities/user.entity';
import { FtpCredential } from './ftp-credential.entity';
import { Photo } from './photo.entity';

@Entity('events')
@Index('idx_events_slug', ['slug'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    name: 'header_subtitle',
    type: 'varchar',
    length: 150,
    nullable: true,
    default: 'The Wedding of',
  })
  headerSubtitle: string | null;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Column({
    type: 'enum',
    enum: EventStatus,
    enumName: 'event_status',
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  @Column({ name: 'theme_color', type: 'varchar', length: 7, default: '#000000' })
  themeColor: string;

  @Column({ name: 'header_image_key', type: 'text', nullable: true })
  headerImageKey: string | null;

  @Column({ name: 'custom_frame_key', type: 'text', nullable: true })
  customFrameKey: string | null;

  @Column({ name: 'require_guest_moderation', type: 'boolean', default: false })
  requireGuestModeration: boolean;

  @Column({ name: 'guest_upload_limit', type: 'int', default: 5 })
  guestUploadLimit: number;

  @Column({ name: 'archive_zip_key', type: 'text', nullable: true })
  archiveZipKey: string | null;

  @Column({
    name: 'archive_status',
    type: 'enum',
    enum: ArchiveStatus,
    enumName: 'archive_status',
    default: ArchiveStatus.NONE,
  })
  archiveStatus: ArchiveStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => User, (user) => user.events, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @OneToOne(() => FtpCredential, (ftpCredential) => ftpCredential.event, {
    cascade: true,
  })
  ftpCredential: FtpCredential;

  @OneToMany(() => Photo, (photo) => photo.event)
  photos: Photo[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

