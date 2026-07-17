import { Module } from '@nestjs/common';
import { FriendshipController } from './friendship.controller';
import { FriendshipService } from './friendship.service';
import { Friendship } from './friendship.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { UserBlock } from '../user/user-block.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Friendship, UserBlock], 'mariadb'),
    UserModule,
    NotificationModule,
  ],
  controllers: [FriendshipController],
  providers: [FriendshipService],
  exports: [FriendshipService],
})
export class FriendshipModule {}
