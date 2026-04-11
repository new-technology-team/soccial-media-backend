import { Injectable } from "@nestjs/common";
import { CreatePostDto } from "./dto/create-post.dto";
import { Post } from "./post.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "../user/user.entity";


@Injectable()
export class PostService {
    constructor(
        @InjectRepository(Post, 'mongodb')
        private readonly postsRepository: Repository<Post>,
        @InjectRepository(User, 'mariadb')
        private readonly usersRepository: Repository<User>,
    ) { }

    async createPost(createPostDto: CreatePostDto): Promise<Post> {
        const user = await this.usersRepository.findOne({ where: { userId: createPostDto.ownerId } });
        
        if (!user) {
            throw new Error("User not found");
        }

        const post = {
            title: createPostDto.title,
            content: createPostDto.content,
            owner: {
                userId: user.userId,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl
            },
        };

        return this.postsRepository.save(post);
    }
}