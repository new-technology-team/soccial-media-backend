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
        post: {
            id: string;
            authorId: any;
            authorName: string;
            authorAvatar: string | null;
            authorRole: string;
            authorAccountStatus: string;
            content: any;
            mediaUrl: any;
            visibility: any;
            status: any;
            reactionCount: any;
            commentCount: number;
            viewerReaction: any;
            createdAt: any;
            updatedAt: any;
        };
    }>;
    getFeedPost(user: any, postId: string): Promise<{
        post: {
            id: string;
            authorId: any;
            authorName: string;
            authorAvatar: string | null;
            authorRole: string;
            authorAccountStatus: string;
            content: any;
            mediaUrl: any;
            visibility: any;
            status: any;
            reactionCount: any;
            commentCount: number;
            viewerReaction: any;
            createdAt: any;
            updatedAt: any;
        };
    }>;
    uploadPostBase64(user: any, body: any): Promise<{
        message: string;
        mediaUrl: string;
    }>;
    updateFeedPost(user: any, postId: string, body: any): Promise<{
        message: string;
        post: {
            id: string;
            authorId: any;
            authorName: string;
            authorAvatar: string | null;
            authorRole: string;
            authorAccountStatus: string;
            content: any;
            mediaUrl: any;
            visibility: any;
            status: any;
            reactionCount: any;
            commentCount: number;
            viewerReaction: any;
            createdAt: any;
            updatedAt: any;
        };
    }>;
    deleteFeedPost(user: any, postId: string): Promise<{
        message: string;
    }>;
    reactPost(user: any, postId: string, body: {
        type: string;
    }): Promise<{
        message: string;
        post: {
            id: string;
            authorId: any;
            authorName: string;
            authorAvatar: string | null;
            authorRole: string;
            authorAccountStatus: string;
            content: any;
            mediaUrl: any;
            visibility: any;
            status: any;
            reactionCount: any;
            commentCount: number;
            viewerReaction: any;
            createdAt: any;
            updatedAt: any;
        };
    }>;
    removeReaction(user: any, postId: string): Promise<{
        message: string;
        post: {
            id: string;
            authorId: any;
            authorName: string;
            authorAvatar: string | null;
            authorRole: string;
            authorAccountStatus: string;
            content: any;
            mediaUrl: any;
            visibility: any;
            status: any;
            reactionCount: any;
            commentCount: number;
            viewerReaction: any;
            createdAt: any;
            updatedAt: any;
        };
    }>;
}
//# sourceMappingURL=post.controller.d.ts.map