import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './module/user/user.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './module/auth/auth.module';
import { PostModule } from './module/post/post.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './module/user/user.entity';
import { CommentModule } from './module/comment/comment.module';
import { ConversationModule } from './module/conversation/conversation.module';
import { FriendshipModule } from './module/friendship/friendship.module';
import { MessageModule } from './module/message/message.module';
import { NotificationModule } from './module/notification/notification.module';
import { ReportModule } from './module/report/report.module';
import { AiModule } from './module/ai/ai.module';
import { Message } from './module/message/message.entity';
import { Conversation } from './module/conversation/conversation.entity';
import { Friendship } from './module/friendship/friendship.entity';
import { Report } from './module/report/report.entity';
import { Comment } from './module/comment/comment.entity';
import { Notification } from './module/notification/notification.entity';
import { Post } from './module/post/post.entity';
import { AuthOtp } from './module/auth/auth-otp.entity';
import { AiMessage } from './module/ai/ai-message.entity';
import { ChatGateway } from './common/socket/chat.gateway';
import { UserBlock } from './module/user/user-block.entity';

function buildMariaUrl(): string {
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

function buildMongoUrl(): string {
  if (process.env.DATABASE_URL_MONGO) {
    return process.env.DATABASE_URL_MONGO;
  }
  return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zalo_app';
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      name: 'mariadb',
      type: 'mariadb',
      url: buildMariaUrl(),
      synchronize: true,
      entities: [User, Friendship, Report, AuthOtp, UserBlock],
      logging: false,
    }),
    TypeOrmModule.forRoot({
      name: 'mongodb',
      type: 'mongodb',
      url: buildMongoUrl(),
      synchronize: true,
      entities: [Comment, Conversation, Message, Notification, Post, AiMessage],
    }),
    AuthModule,
    CommentModule,
    ConversationModule,
    FriendshipModule,
    MessageModule,
    NotificationModule,
    PostModule,
    ReportModule,
    UserModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService, ChatGateway],
})
export class AppModule {}
