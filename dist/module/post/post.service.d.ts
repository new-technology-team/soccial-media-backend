import { CreatePostDto } from "./dto/create-post.dto";
import { Post } from "./post.entity";
import { Repository } from "typeorm";
import { User } from "../user/user.entity";
export declare class PostService {
    private readonly postsRepository;
    private readonly usersRepository;
    constructor(postsRepository: Repository<Post>, usersRepository: Repository<User>);
    createPost(createPostDto: CreatePostDto): Promise<Post>;
    listFeed(viewerUserId?: number, includeHidden?: boolean, limit?: number): Promise<{
        posts: any[];
    }>;
    createFeedPost(actorId: number, body: any): Promise<{
        post: any;
    }>;
    getPostById(postId: string): Promise<any>;
    increaseCommentCount(postId: string): Promise<void>;
    reactPost(actorId: number, postId: string, type: string): Promise<{
        message: string;
        post: any;
    }>;
    removeReaction(actorId: number, postId: string): Promise<{
        message: string;
        post: any;
    }>;
    moderatePost(postId: string, status: string): Promise<any>;
}
