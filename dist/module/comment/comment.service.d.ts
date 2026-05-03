import { Repository } from "typeorm";
import { Comment } from "./comment.entity";
import { UserService } from "../user/user.service";
import { PostService } from "../post/post.service";
export declare class CommentService {
    private readonly commentRepository;
    private readonly userService;
    private readonly postService;
    constructor(commentRepository: Repository<Comment>, userService: UserService, postService: PostService);
    listPostComments(postId: string, viewerUserId?: number, limit?: number, offset?: number): Promise<{
        comments: any[];
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    }>;
    createComment(actorId: number, postId: string, content: string): Promise<{
        comment: any;
    }>;
    reactComment(actorId: number, commentId: string, type: string): Promise<{
        message: string;
        comment: any;
    }>;
    removeCommentReaction(actorId: number, commentId: string): Promise<{
        message: string;
        comment: any;
    }>;
}
//# sourceMappingURL=comment.service.d.ts.map