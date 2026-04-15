import { Module } from "@nestjs/common";
import { CommentController } from "./comment.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Comment } from "./comment.entity";
import { CommentService } from "./comment.service";
import { UserModule } from "../user/user.module";
import { PostModule } from "../post/post.module";

@Module({
    imports: [TypeOrmModule.forFeature([Comment], 'mongodb'), UserModule, PostModule],
    controllers: [CommentController],
    providers: [CommentService],
    exports: [CommentService, TypeOrmModule],
})
export class CommentModule { }