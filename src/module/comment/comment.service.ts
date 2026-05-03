import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import { Comment } from "./comment.entity";
import { UserService } from "../user/user.service";
import { PostService } from "../post/post.service";

@Injectable()
export class CommentService {
	constructor(
		@InjectRepository(Comment, 'mongodb')
		private readonly commentRepository: Repository<Comment>,
		private readonly userService: UserService,
		private readonly postService: PostService,
	) {}

	async listPostComments(postId: string, viewerUserId?: number, limit = 20, offset = 0) {
		const rows = await this.commentRepository.find({
			where: { postId } as any,
			order: { createdAt: 'ASC' },
		});
		const visibleRows = (rows as any[]).filter((row) => row.status === 'visible');
		const safeOffset = Math.max(Number(offset || 0), 0);
		const safeLimit = Math.min(Math.max(Number(limit || 20), 1), 50);
		const pagedRows = visibleRows.slice(safeOffset, safeOffset + safeLimit);

		const comments: any[] = [];
		for (const row of pagedRows) {
			const author = await this.userService.findOne(row.userId);
			comments.push({
				id: String(row._id),
				postId: row.postId,
				userId: row.userId,
				authorName: author?.displayName || 'Người dùng',
				authorAvatar: author?.avatarUrl || null,
				authorRole: author?.role || 'USER',
				content: row.content,
				status: row.status,
				reactionCount: (row.reactions || []).length,
				viewerReaction: (row.reactions || []).find((r: any) => Number(r.userId) === Number(viewerUserId))?.type || null,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			});
		}

		return {
			comments,
			total: visibleRows.length,
			limit: safeLimit,
			offset: safeOffset,
			hasMore: safeOffset + comments.length < visibleRows.length,
		};
	}

	async createComment(actorId: number, postId: string, content: string) {
		await this.postService.getPostById(postId);
		const now = new Date();
		const row = await this.commentRepository.save(
			this.commentRepository.create({
				postId,
				userId: actorId,
				content: String(content || '').trim(),
				file: null as any,
				status: 'visible',
				reactions: [],
				createdAt: now,
				updatedAt: now,
			}),
		);

		await this.postService.increaseCommentCount(postId);

		const { comments } = await this.listPostComments(postId, actorId);
		return { comment: comments.find((item: any) => item.id === String((row as any)._id)) };
	}

	async reactComment(actorId: number, commentId: string, type: string) {
		const row = await this.commentRepository.findOne({ where: { _id: new ObjectId(commentId) as any } });
		if (!row || row.status !== 'visible') {
			throw new NotFoundException('Không tìm thấy bình luận');
		}
		row.reactions = (row.reactions || []).filter((item: any) => Number(item.userId) !== Number(actorId));
		row.reactions.push({ userId: actorId, type: type || 'like', createdAt: new Date() });
		row.updatedAt = new Date();
		await this.commentRepository.save(row);
		const { comments } = await this.listPostComments(row.postId, actorId);
		return { message: 'Đã cập nhật tương tác bình luận', comment: comments.find((item: any) => item.id === commentId) };
	}

	async removeCommentReaction(actorId: number, commentId: string) {
		const row = await this.commentRepository.findOne({ where: { _id: new ObjectId(commentId) as any } });
		if (!row || row.status !== 'visible') {
			throw new NotFoundException('Không tìm thấy bình luận');
		}
		row.reactions = (row.reactions || []).filter((item: any) => Number(item.userId) !== Number(actorId));
		row.updatedAt = new Date();
		await this.commentRepository.save(row);
		const { comments } = await this.listPostComments(row.postId, actorId);
		return { message: 'Đã gỡ tương tác bình luận', comment: comments.find((item: any) => item.id === commentId) };
	}
}
