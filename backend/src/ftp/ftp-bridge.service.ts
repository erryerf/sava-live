import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import { FtpLoginData, FtpSrv } from 'ftp-srv';
import * as path from 'path';
import { Repository } from 'typeorm';
import { EventStatus } from '../database/enums/database.enums';
import { FtpCredential } from '../events/entities/ftp-credential.entity';
import {
  PHOTO_PROCESSING_QUEUE,
  PhotoProcessingJobPayload,
} from '../queues/queue.constants';

export interface FtpEventStatusInfo {
  connected: boolean;
  active_sessions: number;
  last_connected_at: string | null;
  last_upload_at: string | null;
}

@Injectable()
export class FtpBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FtpBridgeService.name);
  private ftpServer: FtpSrv | null = null;
  private readonly tempBaseDir: string;
  private readonly sessionTelemetry = new Map<
    string,
    {
      activeSessions: number;
      lastConnectedAt: string | null;
      lastUploadAt: string | null;
    }
  >();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(FtpCredential)
    private readonly ftpCredentialsRepository: Repository<FtpCredential>,
    @InjectQueue(PHOTO_PROCESSING_QUEUE)
    private readonly photoProcessingQueue: Queue<PhotoProcessingJobPayload>,
  ) {
    const configuredTempDir = this.configService.get<string>(
      'FTP_TEMP_DIR',
      './temp-ftp',
    );
    this.tempBaseDir = path.resolve(process.cwd(), configuredTempDir);
  }

  async onModuleInit(): Promise<void> {
    const enabled =
      this.configService.get<string>('FTP_ENABLED', 'true') === 'true';
    if (!enabled) {
      this.logger.log('FTP Bridge Server is disabled via FTP_ENABLED=false');
      return;
    }

    fs.mkdirSync(this.tempBaseDir, { recursive: true });
    await this.startFtpServer();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.ftpServer) {
      try {
        await this.ftpServer.close();
        this.logger.log('FTP Bridge Server closed cleanly.');
      } catch (err) {
        this.logger.warn(
          `Error closing FTP Bridge Server: ${(err as Error).message}`,
        );
      }
    }
  }

  getEventFtpStatus(eventSlug: string): FtpEventStatusInfo {
    const info = this.sessionTelemetry.get(eventSlug);
    if (!info) {
      return {
        connected: false,
        active_sessions: 0,
        last_connected_at: null,
        last_upload_at: null,
      };
    }

    return {
      connected: info.activeSessions > 0,
      active_sessions: info.activeSessions,
      last_connected_at: info.lastConnectedAt,
      last_upload_at: info.lastUploadAt,
    };
  }

  private async startFtpServer(): Promise<void> {
    const host = this.configService.get<string>('FTP_HOST', '0.0.0.0');
    const port = parseInt(
      this.configService.get<string>('FTP_PORT', '2121'),
      10,
    );
    const pasvUrl = this.configService.get<string>('FTP_PASV_URL', '127.0.0.1');
    const pasvMin = parseInt(
      this.configService.get<string>('FTP_PASV_MIN', '50000'),
      10,
    );
    const pasvMax = parseInt(
      this.configService.get<string>('FTP_PASV_MAX', '50100'),
      10,
    );

    this.ftpServer = new FtpSrv({
      url: `ftp://${host}:${port}`,
      pasv_url: pasvUrl,
      pasv_min: pasvMin,
      pasv_max: pasvMax,
      anonymous: false,
      greeting: ['SAVA Live Roving FTP Bridge Ready'],
    });

    this.ftpServer.on(
      'login',
      async (
        { connection, username, password }: FtpLoginData,
        resolve: (config: { root: string }) => void,
        reject: (err: Error) => void,
      ) => {
        try {
          const cleanSlug = (username || '').trim().toLowerCase();
          if (!cleanSlug || !password) {
            return reject(new Error('Username dan password FTP wajib diisi.'));
          }

          const credential = await this.ftpCredentialsRepository
            .createQueryBuilder('ftp')
            .addSelect('ftp.passwordHash')
            .leftJoinAndSelect('ftp.event', 'event')
            .where('ftp.username = :username', { username: cleanSlug })
            .getOne();

          if (!credential || !credential.isActive || !credential.event) {
            return reject(
              new Error('Kredensial FTP tidak ditemukan atau tidak aktif.'),
            );
          }

          if (credential.event.status !== EventStatus.ACTIVE) {
            return reject(
              new Error(
                `Event "${cleanSlug}" sedang tidak aktif (${credential.event.status}).`,
              ),
            );
          }

          const isValid = await bcrypt.compare(
            password,
            credential.passwordHash,
          );
          if (!isValid) {
            return reject(new Error('Password FTP salah.'));
          }

          // Dynamic folder routing per event slug: /temp-ftp/{slug}/
          const eventTempDir = path.join(this.tempBaseDir, cleanSlug);
          fs.mkdirSync(eventTempDir, { recursive: true });

          const existingTelemetry = this.sessionTelemetry.get(cleanSlug) || {
            activeSessions: 0,
            lastConnectedAt: null,
            lastUploadAt: null,
          };
          existingTelemetry.activeSessions += 1;
          existingTelemetry.lastConnectedAt = new Date().toISOString();
          this.sessionTelemetry.set(cleanSlug, existingTelemetry);

          this.logger.log(
            `Camera authenticated for event "${cleanSlug}" (chroot: ${eventTempDir})`,
          );

          connection.on('STOR', async (error: Error | null, fileName: string) => {
            if (error) {
              this.logger.error(
                `FTP STOR error for event "${cleanSlug}": ${error.message}`,
              );
              return;
            }

            const resolvedFilePath = path.isAbsolute(fileName)
              ? fileName
              : path.join(eventTempDir, path.basename(fileName));

            const telemetry = this.sessionTelemetry.get(cleanSlug);
            if (telemetry) {
              telemetry.lastUploadAt = new Date().toISOString();
            }

            this.logger.log(
              `FTP STOR completed for "${cleanSlug}": ${resolvedFilePath} -> queueing to ${PHOTO_PROCESSING_QUEUE}`,
            );

            try {
              await this.photoProcessingQueue.add('ftp-photo', {
                jobType: 'ftp_upload',
                eventSlug: cleanSlug,
                tempFilePath: resolvedFilePath,
              });
            } catch (queueErr) {
              this.logger.error(
                `Failed to enqueue FTP photo ${resolvedFilePath}: ${(queueErr as Error).message}`,
              );
            }
          });

          connection.on('close', () => {
            const telemetry = this.sessionTelemetry.get(cleanSlug);
            if (telemetry && telemetry.activeSessions > 0) {
              telemetry.activeSessions -= 1;
            }
          });

          return resolve({ root: eventTempDir });
        } catch (err) {
          this.logger.error(
            `Unexpected FTP login error: ${(err as Error).message}`,
          );
          return reject(new Error('Gagal memproses autentikasi FTP.'));
        }
      },
    );

    this.ftpServer.on(
      'client-error',
      ({
        context,
        error,
      }: {
        connection: unknown;
        context: string;
        error: Error;
      }) => {
        this.logger.warn(`FTP client error (${context}): ${error.message}`);
      },
    );

    this.ftpServer.on('server-error', ({ error }: { error: Error }) => {
      this.logger.error(`FTP server error: ${error.message}`);
    });

    try {
      await this.ftpServer.listen();
      this.logger.log(
        `FTP Bridge Server listening on ftp://${host}:${port} (temp root: ${this.tempBaseDir})`,
      );
    } catch (listenError) {
      this.logger.error(
        `Failed to bind FTP Bridge Server on port ${port}: ${(listenError as Error).message}`,
      );
    }
  }
}

