import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const apiPrefix = configService.get<string>('API_PREFIX', 'v1');
  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix);
  }

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = parseInt(configService.get<string>('PORT', '3001'), 10);
  await app.listen(port);
  console.log(`SAVA Live Backend running on http://localhost:${port}/${apiPrefix}`);
}
bootstrap();

