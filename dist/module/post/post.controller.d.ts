import { CreatePostDto } from "./dto/create-post.dto";
import { PostService } from "./post.service";
export declare class PostController {
    private readonly postService;
    constructor(postService: PostService);
    createPost(createPostDto: CreatePostDto): Promise<import("./post.entity").Post>;
    listFeed(user: any, includeHidden?: string, limit?: string): Promise<{
        posts: any[];
    }>;
    createFeedPost(user: any, body: any): Promise<{
        post: any;
    }>;
    reactPost(user: any, postId: string, body: {
        type: string;
    }): Promise<{
        message: string;
        post: any;
    }>;
    removeReaction(user: any, postId: string): Promise<{
        message: string;
        post: any;
    }>;
}
