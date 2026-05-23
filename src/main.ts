import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LogLevel, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import express from 'express';

async function bootstrap() {
  const logLevels = (process.env.NEST_LOG_LEVELS || 'warn,error')
    .split(',')
    .map((level) => level.trim())
    .filter(Boolean) as LogLevel[];

  const app = await NestFactory.create(AppModule, {
    logger: logLevels.length ? logLevels : ['warn', 'error'],
  });
  const rawExpress = app.getHttpAdapter().getInstance();

  // Base64 upload payload can be larger than default parser limit (~100kb).
  rawExpress.use(express.json({ limit: '15mb' }));
  rawExpress.use(express.urlencoded({ extended: true, limit: '15mb' }));

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:5173',
      'http://localhost:19006',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useWebSocketAdapter(new IoAdapter(app));

  const uploadsRoot = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }
  rawExpress.use('/uploads', express.static(uploadsRoot));

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
void bootstrap();
