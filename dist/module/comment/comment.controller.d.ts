import { CommentService } from "./comment.service";
export declare class CommentController {
    private readonly commentService;
    constructor(commentService: CommentService);
    getFeedComments(user: any, postId: string): Promise<{
        comments: any[];
    }>;
    createFeedComment(user: any, postId: string, body: {
        content: string;
    }): Promise<{
        comment: any;
    }>;
    reactFeedComment(user: any, commentId: string, body: {
        type: string;
    }): Promise<{
        message: string;
        comment: any;
    }>;
    removeFeedCommentReaction(user: any, commentId: string): Promise<{
        message: string;
        comment: any;
    }>;
}
