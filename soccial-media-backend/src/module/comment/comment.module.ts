import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './comment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Comment], 'mongodb')],
  controllers: [CommentController],
  providers: [CommentModule],
  exports: [CommentModule, TypeOrmModule],
})
export class CommentModule {}
