import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { Conversation } from './conversation.entity';
import { Message } from '../message/message.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { UserBlock } from '../user/user-block.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message], 'mongodb'),
    TypeOrmModule.forFeature([UserBlock], 'mariadb'),
    UserModule,
    NotificationModule,
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService, TypeOrmModule],
})
export class ConversationModule {}
