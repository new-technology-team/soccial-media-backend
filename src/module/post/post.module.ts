import { Module } from "@nestjs/common";
import { PostController } from "./post.controller";
import { PostService } from "./post.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Post } from "./post.entity";
import { UserModule } from "../user/user.module";

@Module({
    imports: [
        TypeOrmModule.forFeature([Post], 'mongodb'),
        UserModule
    ],
    controllers: [PostController],
    providers: [PostService],
    exports: [PostService, TypeOrmModule],
})
export class PostModule { }