import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FtpCredential } from '../events/entities/ftp-credential.entity';
import { FtpBridgeService } from './ftp-bridge.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([FtpCredential])],
  providers: [FtpBridgeService],
  exports: [FtpBridgeService],
})
export class FtpModule {}

