import { Module } from "@nestjs/common";
import { CommentService } from "./notification.service";
import { CommentController } from "./notification.controller";

@Module({
    controllers: [CommentController],
    providers: [CommentService]
})
export class CommentModule { }