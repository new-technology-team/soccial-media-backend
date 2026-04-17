import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PostController } from "./post.controller";
import { PostService } from "./post.service";
import { Post } from "./post.entity";
import { User } from "../user/user.entity";

@Module({
	imports: [
		TypeOrmModule.forFeature([Post], 'mongodb'),
		TypeOrmModule.forFeature([User], 'mariadb'),
	],
	controllers: [PostController],
	providers: [PostService],
	exports: [PostService, TypeOrmModule],
})
export class PostModule {}
