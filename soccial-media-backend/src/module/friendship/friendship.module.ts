import { Module } from '@nestjs/common';
import { FriendshipService } from './friendship.service';
import { FriendshipController } from './friendship.controller';
import { Friendship } from './friendship.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Friendship], 'mariadb')],
  controllers: [FriendshipController],
  providers: [FriendshipService],
  exports: [FriendshipService, TypeOrmModule],
})
export class FriendshipModule {}
