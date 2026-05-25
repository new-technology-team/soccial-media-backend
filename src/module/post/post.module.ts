import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PostController } from "./post.controller";
import { PostService } from "./post.service";
import { Post } from "./post.entity";
import { User } from "../user/user.entity";
import { Comment } from "../comment/comment.entity";
import { NotificationModule } from "../notification/notification.module";

@Module({
	imports: [
		TypeOrmModule.forFeature([Post], 'mongodb'),
		TypeOrmModule.forFeature([Comment], 'mongodb'),
		TypeOrmModule.forFeature([User], 'mariadb'),
		NotificationModule,
	],
	controllers: [PostController],
	providers: [PostService],
	exports: [PostService, TypeOrmModule],
})
export class PostModule {}
