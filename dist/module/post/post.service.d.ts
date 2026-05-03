import { Repository } from "typeorm";
import { CreatePostDto } from "./dto/create-post.dto";
import { Post } from "./post.entity";
import { User } from "../user/user.entity";
import { Comment } from "../comment/comment.entity";
export declare class PostService {
    private readonly postsRepository;
    private readonly commentsRepository;
    private readonly usersRepository;
    constructor(postsRepository: Repository<Post>, commentsRepository: Repository<Comment>, usersRepository: Repository<User>);
    private getS3Config;
    private getS3Client;
    private safeFileName;
    private extractS3Key;
    private deleteMediaUrl;
    private toFeedPost;
    createPost(createPostDto: CreatePostDto): Promise<Post>;
    listFeed(viewerUserId?: number, includeHidden?: boolean, limit?: number): Promise<{
        posts: any[];
    }>;
    createFeedPost(actorId: number, body: any): Promise<{
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
    getPostById(postId: string): Promise<any>;
    getFeedPost(postId: string, viewerUserId?: number): Promise<{
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
    uploadPostBase64(actorId: number, body: {
        fileName: string;
        contentType: string;
        base64Data: string;
    }): Promise<{
        message: string;
        mediaUrl: string;
    }>;
    increaseCommentCount(postId: string): Promise<void>;
    updateFeedPost(actorId: number, postId: string, body: any): Promise<{
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
    deleteFeedPost(actorId: number, postId: string): Promise<{
        message: string;
    }>;
    reactPost(actorId: number, postId: string, type: string): Promise<{
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
    removeReaction(actorId: number, postId: string): Promise<{
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
    moderatePost(postId: string, status: string): Promise<any>;
}
//# sourceMappingURL=post.service.d.ts.map