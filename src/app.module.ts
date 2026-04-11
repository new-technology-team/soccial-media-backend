import { Module, Post } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      port: 3306,
      username: 'root',
      password: '123456',
      database: 'social_media',
      synchronize: true,
      entities: [User, Friendship, Report],
    }),
    TypeOrmModule.forRoot({
      type: 'mongodb',
      port: 27017,
      username: 'root',
      password: '123456',
      database: 'social_media',
      synchronize: true,
      entities: [Comment, Conversation, Message, Notification],
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
