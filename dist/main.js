"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const path_1 = require("path");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:19006')
            .split(',')
            .map((origin) => origin.trim()),
        credentials: true,
    });
    app.useStaticAssets((0, path_1.join)(process.cwd(), 'uploads'), { prefix: '/uploads/' });
    const port = Number(process.env.PORT ?? 5000);
    await app.listen(port);
    console.log(`API listening on http://localhost:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map