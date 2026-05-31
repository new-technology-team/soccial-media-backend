import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { PostModule } from '../post/post.module';
import { Friendship } from '../friendship/friendship.entity';
import { BlockedUser } from '../friendship/blocked-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Friendship, BlockedUser], 'mariadb'), PostModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule { }
