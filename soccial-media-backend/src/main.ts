import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LogLevel, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const logLevels = (process.env.NEST_LOG_LEVELS || 'warn,error')
    .split(',')
    .map((level) => level.trim())
    .filter(Boolean) as LogLevel[];

  const app = await NestFactory.create(AppModule, {
    logger: logLevels.length ? logLevels : ['warn', 'error'],
  });
  const rawExpress = app.getHttpAdapter().getInstance();

  // Security headers
  rawExpress.use(helmet());

  // Compression (free-tier friendly, reduces bandwidth)
  rawExpress.use(compression());

  // Base64 upload payload can be larger than default parser limit (~100kb).
  rawExpress.use(express.json({ limit: '25mb' }));
  rawExpress.use(express.urlencoded({ extended: true, limit: '25mb' }));

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:5173',
      'http://localhost:19006',
    ],
    credentials: true,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());

  app.useWebSocketAdapter(new IoAdapter(app));

  const uploadsRoot = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }
  rawExpress.use('/uploads', express.static(uploadsRoot));

  const port = process.env.PORT || process.env.API_PORT || 5007;

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}

// Process-level error handlers (prevent crashes on unhandled rejections)
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

void bootstrap();
