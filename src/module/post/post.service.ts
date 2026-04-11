import { Injectable } from "@nestjs/common";
import { CreatePostDto } from "./dto/create-post.dto";
import { Post } from "./post.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";


@Injectable()
export class PostService {
    constructor(
        @InjectRepository(Post)
        private readonly postsRepository: Repository<Post>,
    ) { }

    async createPost(createPostDto: CreatePostDto): Promise<Post> {
        const post = {
            title: createPostDto.title,
            content: createPostDto.content,
        };

        return this.postsRepository.save(post);
    }
}