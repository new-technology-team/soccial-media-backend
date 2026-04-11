import { Injectable } from "@nestjs/common";
import { Post } from "../../../generated/mongo"; 
import { MongoService } from "../../prisma/mongo/mongo.service";
import { CreatePostDto } from "./dto/create-post.dto";


@Injectable()
export class PostService {
    constructor(
        private readonly mongoService: MongoService
    ) { }

    async createPost(createPostDto: CreatePostDto): Promise<void> {
        
    }
}