import { Module } from "@nestjs/common";
import { CommentService } from "./friendship.service";
import { CommentController } from "./friendship.controller";

@Module({
    controllers: [CommentController],
    providers: [CommentService]
})
export class CommentModule { }