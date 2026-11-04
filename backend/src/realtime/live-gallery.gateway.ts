import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { PhotoProcessingProcessor } from '../queues/photo-processing.processor';
import { NewPhotoBroadcastPayload } from '../queues/queue.constants';

const REDIS_PUBSUB_CHANNEL = 'sava:live_gallery:events';

interface RedisPubSubMessage {
  type: 'NEW_PHOTO' | 'PHOTO_DELETED' | 'EVENT_STATUS_CHANGED';
  eventSlug: string;
  payload: unknown;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class LiveGalleryGateway
  implements
    OnModuleInit,
    OnModuleDestroy,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  private readonly logger = new Logger(LiveGalleryGateway.name);

  @WebSocketServer()
  server: Server;

  private redisPub: Redis | null = null;
  private redisSub: Redis | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly photoProcessingProcessor: PhotoProcessingProcessor,
  ) {}

  async onModuleInit(): Promise<void> {
    // 1. Register callback on PhotoProcessingProcessor so completed worker jobs emit NEW_PHOTO
    this.photoProcessingProcessor.registerBroadcastCallback(
      async (eventSlug, payload) => {
        await this.broadcastNewPhoto(eventSlug, payload);
      },
    );

    // 2. Setup Redis Pub/Sub so multi-process or multi-instance workers also fan out cleanly
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = parseInt(
      this.configService.get<string>('REDIS_PORT', '6379'),
      10,
    );
    const redisPassword =
      this.configService.get<string>('REDIS_PASSWORD') || undefined;

    try {
      this.redisPub = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        lazyConnect: true,
        maxRetriesPerRequest: 2,
      });

      this.redisSub = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        lazyConnect: true,
        maxRetriesPerRequest: 2,
      });

      this.redisPub.on('error', (err) =>
        this.logger.warn(`Redis Pub warning: ${err.message}`),
      );
      this.redisSub.on('error', (err) =>
        this.logger.warn(`Redis Sub warning: ${err.message}`),
      );

      await this.redisPub.connect();
      await this.redisSub.connect();
      await this.redisSub.subscribe(REDIS_PUBSUB_CHANNEL);

      this.redisSub.on('message', (channel, rawMessage) => {
        if (channel !== REDIS_PUBSUB_CHANNEL) return;
        try {
          const parsed = JSON.parse(rawMessage) as RedisPubSubMessage;
          this.emitToLocalRoom(parsed.type, parsed.eventSlug, parsed.payload);
        } catch (err) {
          this.logger.warn(
            `Invalid Redis Pub/Sub message: ${(err as Error).message}`,
          );
        }
      });

      this.logger.log(
        `WebSocket Gateway bound to Redis Pub/Sub channel "${REDIS_PUBSUB_CHANNEL}"`,
      );
    } catch (err) {
      this.logger.warn(
        `Redis Pub/Sub unavailable, falling back to direct in-memory Socket.io room emission: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redisSub?.quit();
      await this.redisPub?.quit();
    } catch {
      // Ignore shutdown errors
    }
  }

  handleConnection(client: Socket) {
    const slugQuery = client.handshake.query?.slug;
    if (typeof slugQuery === 'string' && slugQuery.trim()) {
      const room = this.normalizeRoomName(slugQuery);
      void client.join(room);
      this.logger.log(`Client ${client.id} auto-joined room ${room}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  public normalizeRoomName(roomOrSlug: string): string {
    const cleaned = roomOrSlug.trim().replace(/^\/+|\/+$/g, '');
    return cleaned.startsWith('event_') ? cleaned : `event_${cleaned}`;
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { room?: string; slug?: string; data?: { room?: string } } | string,
  ) {
    let rawRoom = '';
    if (typeof body === 'string') {
      rawRoom = body;
    } else if (body && typeof body === 'object') {
      rawRoom = body.room || body.slug || body.data?.room || '';
    }

    if (!rawRoom) {
      return {
        event: 'error',
        data: { message: 'Room atau event_slug wajib dikirim.' },
      };
    }

    const roomName = this.normalizeRoomName(rawRoom);
    await client.join(roomName);
    this.logger.log(`Socket ${client.id} subscribed to room "${roomName}"`);

    return {
      event: 'subscribed',
      data: { room: roomName },
    };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { room?: string; slug?: string } | string,
  ) {
    const rawRoom =
      typeof body === 'string' ? body : body?.room || body?.slug || '';
    if (!rawRoom) return;

    const roomName = this.normalizeRoomName(rawRoom);
    await client.leave(roomName);
    return {
      event: 'unsubscribed',
      data: { room: roomName },
    };
  }

  private emitToLocalRoom(
    type: 'NEW_PHOTO' | 'PHOTO_DELETED' | 'EVENT_STATUS_CHANGED',
    eventSlug: string,
    payload: unknown,
  ) {
    if (!this.server) return;
    const roomName = this.normalizeRoomName(eventSlug);

    if (type === 'NEW_PHOTO') {
      const photoData = payload as NewPhotoBroadcastPayload;
      this.server.to(roomName).emit('NEW_PHOTO', {
        event: 'NEW_PHOTO',
        data: photoData,
        ...photoData,
      });
    } else if (type === 'PHOTO_DELETED') {
      this.server.to(roomName).emit('PHOTO_DELETED', {
        event: 'PHOTO_DELETED',
        data: payload,
      });
    } else if (type === 'EVENT_STATUS_CHANGED') {
      this.server.to(roomName).emit('EVENT_STATUS_CHANGED', {
        event: 'EVENT_STATUS_CHANGED',
        data: payload,
      });
    }
  }

  async broadcastNewPhoto(
    eventSlug: string,
    payload: NewPhotoBroadcastPayload,
  ): Promise<void> {
    const message: RedisPubSubMessage = {
      type: 'NEW_PHOTO',
      eventSlug,
      payload,
    };

    if (this.redisPub && this.redisPub.status === 'ready') {
      await this.redisPub.publish(
        REDIS_PUBSUB_CHANNEL,
        JSON.stringify(message),
      );
    } else {
      this.emitToLocalRoom('NEW_PHOTO', eventSlug, payload);
    }

    this.logger.log(
      `Broadcasted NEW_PHOTO (${payload.id}) to room "${this.normalizeRoomName(eventSlug)}"`,
    );
  }

  async broadcastPhotoDeleted(eventSlug: string, photoId: string): Promise<void> {
    const message: RedisPubSubMessage = {
      type: 'PHOTO_DELETED',
      eventSlug,
      payload: { id: photoId },
    };

    if (this.redisPub && this.redisPub.status === 'ready') {
      await this.redisPub.publish(
        REDIS_PUBSUB_CHANNEL,
        JSON.stringify(message),
      );
    } else {
      this.emitToLocalRoom('PHOTO_DELETED', eventSlug, { id: photoId });
    }
  }

  async broadcastEventStatusChanged(
    eventSlug: string,
    status: string,
  ): Promise<void> {
    const message: RedisPubSubMessage = {
      type: 'EVENT_STATUS_CHANGED',
      eventSlug,
      payload: { slug: eventSlug, status },
    };

    if (this.redisPub && this.redisPub.status === 'ready') {
      await this.redisPub.publish(
        REDIS_PUBSUB_CHANNEL,
        JSON.stringify(message),
      );
    } else {
      this.emitToLocalRoom('EVENT_STATUS_CHANGED', eventSlug, {
        slug: eventSlug,
        status,
      });
    }
  }
}

