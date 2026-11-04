import { Global, Module } from '@nestjs/common';
import { LiveGalleryGateway } from './live-gallery.gateway';

@Global()
@Module({
  providers: [LiveGalleryGateway],
  exports: [LiveGalleryGateway],
})
export class RealtimeModule {}

