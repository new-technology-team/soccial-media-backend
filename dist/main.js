"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const path_1 = require("path");
const socket_io_1 = require("socket.io");
const express_1 = require("express");
const chat_socket_1 = require("./common/socket/chat-socket");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:19006')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: allowedOrigins,
        credentials: true,
    });
    app.useStaticAssets((0, path_1.join)(process.cwd(), 'uploads'), { prefix: '/uploads/' });
    app.use((0, express_1.json)({ limit: '20mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: '20mb' }));
    const io = new socket_io_1.Server(app.getHttpServer(), {
        cors: {
            origin: allowedOrigins,
            credentials: true,
        },
    });
    (0, chat_socket_1.setChatSocketServer)(io);
    (0, chat_socket_1.registerChatSocketHandlers)(io);
    const port = Number(process.env.PORT ?? 5000);
    await app.listen(port);
    console.log(`API listening on http://localhost:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map