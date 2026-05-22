import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CommentService } from "./comment.service";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";

@Controller('social')
export class CommentController {
	constructor(private readonly commentService: CommentService) {}

	@Get('posts/:postId/comments')
	getFeedComments(@CurrentUser() user: any, @Param('postId') postId: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
		return this.commentService.listPostComments(postId, user?.id, Number(limit || 20), Number(offset || 0));
	}

	@UseGuards(JwtAuthGuard)
	@Post('posts/:postId/comments')
	createFeedComment(@CurrentUser() user: any, @Param('postId') postId: string, @Body() body: { content: string }) {
		return this.commentService.createComment(user.id, postId, body?.content);
	}

	@UseGuards(JwtAuthGuard)
	@Post('comments/:commentId/reaction')
	reactFeedComment(@CurrentUser() user: any, @Param('commentId') commentId: string, @Body() body: { type: string }) {
		return this.commentService.reactComment(user.id, commentId, body?.type || 'like');
	}

	@UseGuards(JwtAuthGuard)
	@Delete('comments/:commentId/reaction')
	removeFeedCommentReaction(@CurrentUser() user: any, @Param('commentId') commentId: string) {
		return this.commentService.removeCommentReaction(user.id, commentId);
	}

	@UseGuards(JwtAuthGuard)
	@Delete('comments/:commentId')
	deleteFeedComment(@CurrentUser() user: any, @Param('commentId') commentId: string) {
		return this.commentService.deleteComment(user.id, commentId);
	}
}
