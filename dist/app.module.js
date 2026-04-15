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
const message_entity_1 = require("./module/message/message.entity");
const conversation_entity_1 = require("./module/conversation/conversation.entity");
const friendship_entity_1 = require("./module/friendship/friendship.entity");
const report_entity_1 = require("./module/report/report.entity");
const comment_entity_1 = require("./module/comment/comment.entity");
const notification_entity_1 = require("./module/notification/notification.entity");
const post_entity_1 = require("./module/post/post.entity");
const auth_otp_entity_1 = require("./module/auth/auth-otp.entity");
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
                url: process.env.DATABASE_URL_MARIA,
                synchronize: true,
                entities: [user_entity_1.User, friendship_entity_1.Friendship, report_entity_1.Report, auth_otp_entity_1.AuthOtp],
            }),
            typeorm_1.TypeOrmModule.forRoot({
                name: 'mongodb',
                type: 'mongodb',
                url: process.env.DATABASE_URL_MONGO,
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
            user_module_1.UserModule
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map