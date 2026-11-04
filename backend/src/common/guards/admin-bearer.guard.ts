import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminBearerGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Akses ditolak. Token tidak ditemukan.');
    }

    const token = authHeader.slice(7).trim();
    const expectedToken =
      this.configService.get<string>('ADMIN_API_TOKEN') ||
      'sava-admin-secret-token-2026';

    if (!token || token !== expectedToken) {
      throw new UnauthorizedException('Token admin tidak valid.');
    }

    return true;
  }
}

