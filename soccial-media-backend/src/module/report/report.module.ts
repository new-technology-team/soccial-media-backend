import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { Report } from './report.entity';
import { Post } from '../post/post.entity';
import { Comment } from '../comment/comment.entity';
import { Message } from '../message/message.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report], 'mariadb'),
    TypeOrmModule.forFeature([Post, Comment, Message], 'mongodb'),
  ],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
