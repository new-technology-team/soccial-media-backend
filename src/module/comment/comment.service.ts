import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import * as fs from "fs";
import * as path from "path";
import { Comment } from "./comment.entity";
import { UserService } from "../user/user.service";
import { PostService } from "../post/post.service";
import { NotificationService } from "../notification/notification.service";
import { emitSocialEvent } from "../../common/socket/chat-socket";

@Injectable()
export class CommentService {
	constructor(
		@InjectRepository(Comment, 'mongodb')
		private readonly commentRepository: Repository<Comment>,
		private readonly userService: UserService,
		private readonly postService: PostService,
		private readonly notificationService: NotificationService,
	) {}

	private isValidObjectId(value: string) {
		return ObjectId.isValid(String(value || ''));
	}

	private async findCommentById(commentId: string) {
		if (!this.isValidObjectId(commentId)) return null;
		return this.commentRepository.findOne({ where: { _id: new ObjectId(commentId) as any } });
	}

	private getS3Config() {
		const bucket = process.env.AWS_S3_BUCKET || process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET || '';
		const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-1';
		return { bucket, region };
	}

	private getS3Client() {
		const { region } = this.getS3Config();
		return new S3Client({
			region,
			credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
				? {
					accessKeyId: process.env.AWS_ACCESS_KEY_ID,
					secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
					sessionToken: process.env.AWS_SESSION_TOKEN || undefined,
				}
				: undefined,
		});
	}

	private safeFileName(name: string) {
		const ext = path.extname(name || '').slice(0, 24);
		const base = path.basename(name || 'comment-image', ext).replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 64) || 'comment-image';
		return `${Date.now()}-${base}${ext}`;
	}

	private async mapComment(row: any, viewerUserId?: number) {
		const author = await this.userService.findOne(row.userId);
		return {
			id: String(row._id),
			postId: row.postId,
			parentCommentId: row.parentCommentId || null,
			userId: row.userId,
			authorName: author?.displayName || 'Nguoi dung',
			authorAvatar: author?.avatarUrl || null,
			authorRole: author?.role || 'USER',
			content: row.content || '',
			imageUrl: row.file || null,
			file: row.file || null,
			status: row.status,
			reactionCount: (row.reactions || []).length,
			viewerReaction: (row.reactions || []).find((r: any) => Number(r.userId) === Number(viewerUserId))?.type || null,
			replies: [],
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	}

	async listPostComments(postId: string, viewerUserId?: number, limit = 20, offset = 0) {
		const rows = await this.commentRepository.find({
			where: { postId } as any,
			order: { createdAt: 'ASC' },
		});
		const visibleRows = (rows as any[]).filter((row) => row.status === 'visible');
		const safeOffset = Math.max(Number(offset || 0), 0);
		const safeLimit = Math.min(Math.max(Number(limit || 20), 1), 50);
		const mapped = await Promise.all(visibleRows.map((row) => this.mapComment(row, viewerUserId)));
		const byParent = new Map<string, any[]>();
		for (const comment of mapped) {
			const parentKey = comment.parentCommentId ? String(comment.parentCommentId) : '';
			byParent.set(parentKey, [...(byParent.get(parentKey) || []), comment]);
		}
		const attachReplies = (comment: any): any => ({
			...comment,
			replies: (byParent.get(String(comment.id)) || []).map(attachReplies),
		});
		const topLevel = (byParent.get('') || []).map(attachReplies);
		const comments = topLevel.slice(safeOffset, safeOffset + safeLimit);

		return {
			comments,
			total: topLevel.length,
			limit: safeLimit,
			offset: safeOffset,
			hasMore: safeOffset + comments.length < topLevel.length,
		};
	}

	async createComment(actorId: number, postId: string, content: string, parentCommentId?: string | null, imageUrl?: string | null) {
		await this.postService.getPostById(postId);
		const normalizedContent = String(content || '').trim();
		const normalizedImageUrl = imageUrl ? String(imageUrl).trim() : null;
		const normalizedParentId = parentCommentId ? String(parentCommentId).trim() : null;
		if (!normalizedContent && !normalizedImageUrl) {
			throw new BadRequestException('Binh luan can co noi dung hoac anh');
		}
		if (normalizedParentId) {
			const parent = await this.findCommentById(normalizedParentId);
			if (!parent || parent.status !== 'visible' || String(parent.postId) !== String(postId)) {
				throw new NotFoundException('Khong tim thay binh luan cha');
			}
		}
		const now = new Date();
		const row = await this.commentRepository.save(
			this.commentRepository.create({
				postId,
				parentCommentId: normalizedParentId as any,
				userId: actorId,
				content: normalizedContent,
				file: normalizedImageUrl as any,
				status: 'visible',
				reactions: [],
				createdAt: now,
				updatedAt: now,
			}),
		);

		await this.postService.increaseCommentCount(postId);
		const post = await this.postService.getPostById(postId);
		if (Number(post.authorId) !== Number(actorId)) {
			const actor = await this.userService.findOne(actorId);
			await this.notificationService.createNotification({
				userId: Number(post.authorId),
				type: 'comment',
				title: `${actor?.displayName || 'Mot nguoi dung'} da binh luan bai viet`,
				body: (normalizedContent || 'Da gui anh trong binh luan').slice(0, 120),
				meta: { postId, commentId: String((row as any)._id), actorId },
			});
		}

		const comment = await this.mapComment(row, actorId);
		emitSocialEvent('comment:created', {
			postId,
			parentCommentId: normalizedParentId,
			actorId,
			comment,
			commentCount: Number(post.commentCount || 0),
		});
		return { comment };
	}

	async createReply(actorId: number, parentCommentId: string, content: string, imageUrl?: string | null) {
		const parent = await this.findCommentById(parentCommentId);
		if (!parent || parent.status !== 'visible') {
			throw new NotFoundException('Khong tim thay binh luan cha');
		}
		return this.createComment(actorId, parent.postId, content, parentCommentId, imageUrl);
	}

	async uploadCommentBase64(actorId: number, body: { fileName: string; contentType: string; base64Data: string }) {
		if (!body?.base64Data) {
			throw new BadRequestException('Thieu du lieu anh binh luan');
		}
		const contentType = body.contentType || 'application/octet-stream';
		if (!contentType.startsWith('image/')) {
			throw new BadRequestException('Binh luan chi ho tro tep anh');
		}
		const rawBase64 = String(body.base64Data).includes(',')
			? String(body.base64Data).split(',').pop() || ''
			: String(body.base64Data);
		const buffer = Buffer.from(rawBase64, 'base64');
		const outputName = this.safeFileName(body.fileName || 'comment-image');
		const { bucket, region } = this.getS3Config();
		if (bucket) {
			const key = `uploads/comments/${actorId}/${outputName}`;
			await this.getS3Client().send(new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				Body: buffer,
				ContentType: contentType,
			}));
			return { mediaUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}` };
		}
		const outputDir = path.join(process.cwd(), 'uploads', 'comments', String(actorId));
		await fs.promises.mkdir(outputDir, { recursive: true });
		await fs.promises.writeFile(path.join(outputDir, outputName), buffer);
		return { mediaUrl: `/uploads/comments/${actorId}/${outputName}` };
	}

	async reactComment(actorId: number, commentId: string, type: string) {
		const row = await this.findCommentById(commentId);
		if (!row || row.status !== 'visible') {
			throw new NotFoundException('Khong tim thay binh luan');
		}
		row.reactions = (row.reactions || []).filter((item: any) => Number(item.userId) !== Number(actorId));
		row.reactions.push({ userId: actorId, type: type || 'like', createdAt: new Date() });
		row.updatedAt = new Date();
		await this.commentRepository.save(row);
		emitSocialEvent('comment:reaction', {
			postId: row.postId,
			commentId,
			actorId,
			reaction: type || 'like',
			reactionCount: (row.reactions || []).length,
		});
		if (Number(row.userId) !== Number(actorId)) {
			const actor = await this.userService.findOne(actorId);
			await this.notificationService.createNotification({
				userId: Number(row.userId),
				type: 'like',
				title: `${actor?.displayName || 'Mot nguoi dung'} da tha cam xuc binh luan`,
				body: String(row.content || '').slice(0, 120),
				meta: { postId: row.postId, commentId, actorId, reaction: type || 'like' },
			});
		}
		return { message: 'Da cap nhat tuong tac binh luan', comment: await this.mapComment(row, actorId) };
	}

	async removeCommentReaction(actorId: number, commentId: string) {
		const row = await this.findCommentById(commentId);
		if (!row || row.status !== 'visible') {
			throw new NotFoundException('Khong tim thay binh luan');
		}
		row.reactions = (row.reactions || []).filter((item: any) => Number(item.userId) !== Number(actorId));
		row.updatedAt = new Date();
		await this.commentRepository.save(row);
		emitSocialEvent('comment:reaction', {
			postId: row.postId,
			commentId,
			actorId,
			reaction: null,
			reactionCount: (row.reactions || []).length,
		});
		return { message: 'Da go tuong tac binh luan', comment: await this.mapComment(row, actorId) };
	}

	async deleteComment(actor: any, commentId: string) {
		const actorId = Number(actor?.id || actor?.userId || actor || 0);
		const actorRole = String(actor?.role || '').toLowerCase();
		const canModerate = actorRole === 'admin' || actorRole === 'moderator';
		const row = await this.findCommentById(commentId);
		if (!row) {
			throw new NotFoundException('Khong tim thay binh luan');
		}
		if (row.status !== 'visible') {
			if (canModerate) {
				return { message: 'Binh luan da duoc xu ly truoc do', alreadyDeleted: true };
			}
			throw new NotFoundException('Khong tim thay binh luan');
		}

		const post = await this.postService.getPostById(row.postId);
		if (Number(row.userId) !== Number(actorId) && Number(post.authorId) !== Number(actorId) && !canModerate) {
			throw new ForbiddenException('Ban khong co quyen xoa binh luan nay');
		}

		row.status = 'deleted';
		row.updatedAt = new Date();
		await this.commentRepository.save(row);
		await this.postService.decreaseCommentCount(row.postId);
		const updatedPost = await this.postService.getPostById(row.postId);
		emitSocialEvent('comment:deleted', {
			postId: row.postId,
			commentId,
			actorId,
			commentCount: Number(updatedPost.commentCount || 0),
		});
		return { message: 'Da xoa binh luan' };
	}
}
