import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { Message } from './message.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Message], 'mongodb')],
  controllers: [],
  providers: [MessageService],
  exports: [MessageService, TypeOrmModule],
})
export class MessageModule {}
