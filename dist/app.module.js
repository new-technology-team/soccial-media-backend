"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const user_module_1 = require("./module/user/user.module");
const config_1 = require("@nestjs/config");
const auth_module_1 = require("./module/auth/auth.module");
const post_module_1 = require("./module/post/post.module");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("./module/user/user.entity");
const comment_module_1 = require("./module/comment/comment.module");
const conversation_module_1 = require("./module/conversation/conversation.module");
const friendship_module_1 = require("./module/friendship/friendship.module");
const message_module_1 = require("./module/message/message.module");
const notification_module_1 = require("./module/notification/notification.module");
const report_module_1 = require("./module/report/report.module");
const ai_module_1 = require("./module/ai/ai.module");
const message_entity_1 = require("./module/message/message.entity");
const conversation_entity_1 = require("./module/conversation/conversation.entity");
const friendship_entity_1 = require("./module/friendship/friendship.entity");
const report_entity_1 = require("./module/report/report.entity");
const comment_entity_1 = require("./module/comment/comment.entity");
const notification_entity_1 = require("./module/notification/notification.entity");
const post_entity_1 = require("./module/post/post.entity");
const auth_otp_entity_1 = require("./module/auth/auth-otp.entity");
function buildMariaUrl() {
    if (process.env.DATABASE_URL_MARIA) {
        return process.env.DATABASE_URL_MARIA;
    }
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '3306';
    const user = process.env.DB_USER || 'root';
    const pass = process.env.DB_PASSWORD || 'root';
    const db = process.env.DB_NAME || 'zalo_app';
    return `mariadb://${user}:${pass}@${host}:${port}/${db}`;
}
function buildMongoUrl() {
    if (process.env.DATABASE_URL_MONGO) {
        return process.env.DATABASE_URL_MONGO;
    }
    return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zalo_app';
}
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            typeorm_1.TypeOrmModule.forRoot({
                name: 'mariadb',
                type: 'mariadb',
                url: buildMariaUrl(),
                synchronize: true,
                entities: [user_entity_1.User, friendship_entity_1.Friendship, report_entity_1.Report, auth_otp_entity_1.AuthOtp],
            }),
            typeorm_1.TypeOrmModule.forRoot({
                name: 'mongodb',
                type: 'mongodb',
                url: buildMongoUrl(),
                synchronize: true,
                entities: [comment_entity_1.Comment, conversation_entity_1.Conversation, message_entity_1.Message, notification_entity_1.Notification, post_entity_1.Post],
            }),
            auth_module_1.AuthModule,
            comment_module_1.CommentModule,
            conversation_module_1.ConversationModule,
            friendship_module_1.FriendshipModule,
            message_module_1.MessageModule,
            notification_module_1.NotificationModule,
            post_module_1.PostModule,
            report_module_1.ReportModule,
            user_module_1.UserModule,
            ai_module_1.AiModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map