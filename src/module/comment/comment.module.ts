import { Module } from "@nestjs/common";
import { CommentController } from "./comment.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Comment } from "./comment.entity";

@Module({
    imports: [TypeOrmModule.forFeature([Comment])],
    controllers: [CommentController],
    providers: [CommentModule]
})
export class CommentModule { }