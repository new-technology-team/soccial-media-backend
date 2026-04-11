import { Module } from "@nestjs/common";
import { CommentService } from "./conversation.service";
import { CommentController } from "./conversation.controller";

@Module({
    controllers: [CommentController],
    providers: [CommentService]
})
export class CommentModule {}