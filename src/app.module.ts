import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from "./module/user/user.module";
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
import { Message } from './module/message/message.entity';
import { Conversation } from './module/conversation/conversation.entity';
import { Friendship } from './module/friendship/friendship.entity';
import { Report } from './module/report/report.entity';
import { Comment } from './module/comment/comment.entity';
import { Notification } from './module/notification/notification.entity';
import { Post } from './module/post/post.entity';
import { AuthOtp } from './module/auth/auth-otp.entity';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      name: 'mariadb',
      type: 'mariadb',
      url: process.env.DATABASE_URL_MARIA,
      synchronize: true,
      entities: [User, Friendship, Report, AuthOtp],
    }),
    TypeOrmModule.forRoot({
      name: 'mongodb',
      type: 'mongodb',
      url: process.env.DATABASE_URL_MONGO,
      synchronize: true,
      entities: [Comment, Conversation, Message, Notification, Post],
    }),
    AuthModule,
    CommentModule,
    ConversationModule,
    FriendshipModule,
    MessageModule,
    NotificationModule,
    PostModule,
    ReportModule,
    UserModule
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {

}
