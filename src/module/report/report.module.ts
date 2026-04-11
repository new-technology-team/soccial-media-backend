import { Module } from "@nestjs/common";
import { CommentService } from "./report.service";
import { CommentController } from "./report.controller";

@Module({
    controllers: [CommentController],
    providers: [CommentService]
})
export class CommentModule { }