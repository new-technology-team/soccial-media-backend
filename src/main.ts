import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { Server } from 'socket.io';
import { json, urlencoded } from 'express';
import { registerChatSocketHandlers, setChatSocketServer } from './common/socket/chat-socket';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:8088,http://localhost:19006')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  const io = new Server(app.getHttpServer(), {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });
  setChatSocketServer(io);
  registerChatSocketHandlers(io);

  const port = Number(process.env.PORT ?? 5000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api`);
}
bootstrap();
