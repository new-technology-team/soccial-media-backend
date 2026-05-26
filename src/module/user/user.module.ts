import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Friendship } from '../friendship/friendship.entity';
import { UserBlock } from './user-block.entity';
import { User } from './user.entity';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Friendship, UserBlock], 'mariadb')],
  providers: [UserService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
