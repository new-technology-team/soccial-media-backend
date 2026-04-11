import { Module } from "@nestjs/common";
import { CommentService } from "./message.service";
import { CommentController } from "./message.controller";

@Module({
    controllers: [CommentController],
    providers: [CommentService]
})
export class CommentModule {}