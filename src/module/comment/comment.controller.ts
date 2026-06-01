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
	createFeedComment(@CurrentUser() user: any, @Param('postId') postId: string, @Body() body: { content: string; parentCommentId?: string | null; imageUrl?: string | null }) {
		return this.commentService.createComment(user.id, postId, body?.content, body?.parentCommentId, body?.imageUrl);
	}

	@UseGuards(JwtAuthGuard)
	@Post('comments/:commentId/replies')
	createFeedCommentReply(@CurrentUser() user: any, @Param('commentId') commentId: string, @Body() body: { content: string; imageUrl?: string | null }) {
		return this.commentService.createReply(user.id, commentId, body?.content, body?.imageUrl);
	}

	@UseGuards(JwtAuthGuard)
	@Post('comments/upload-base64')
	uploadFeedCommentImage(@CurrentUser() user: any, @Body() body: { fileName: string; contentType: string; base64Data: string }) {
		return this.commentService.uploadCommentBase64(user.id, body);
	}

	@UseGuards(JwtAuthGuard)
	@Post('comments/:commentId/reaction')
	reactFeedComment(@CurrentUser() user: any, @Param('commentId') commentId: string, @Body() body: { type: string }) {
		return this.commentService.reactComment(user.id, commentId, body?.type || 'like');
	}

	@Get('comments/:commentId/reactions')
	listFeedCommentReactions(@Param('commentId') commentId: string) {
		return this.commentService.listCommentReactions(commentId);
	}

	@UseGuards(JwtAuthGuard)
	@Delete('comments/:commentId/reaction')
	removeFeedCommentReaction(@CurrentUser() user: any, @Param('commentId') commentId: string) {
		return this.commentService.removeCommentReaction(user.id, commentId);
	}

	@UseGuards(JwtAuthGuard)
	@Delete('comments/:commentId')
	deleteFeedComment(@CurrentUser() user: any, @Param('commentId') commentId: string) {
		return this.commentService.deleteComment(user, commentId);
	}
}
