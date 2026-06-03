import { Module } from '@nestjs/common';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './post.entity';
import { UserModule } from '../user/user.module';
import { Friendship } from '../friendship/friendship.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post], 'mongodb'),
    TypeOrmModule.forFeature([Friendship], 'mariadb'),
    UserModule,
    NotificationModule,
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService, TypeOrmModule],
})
export class PostModule {}
