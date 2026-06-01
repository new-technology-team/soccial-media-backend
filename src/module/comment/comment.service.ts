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

/**
 * Service xử lý toàn bộ logic liên quan đến bình luận:
 * - Lấy danh sách bình luận của bài viết
 * - Tạo bình luận mới
 * - Tạo phản hồi bình luận
 * - Upload ảnh cho bình luận
 * - Thả cảm xúc bình luận
 * - Gỡ cảm xúc bình luận
 * - Xóa bình luận
 */
@Injectable()
export class CommentService {
	constructor(
		// Inject repository Comment để thao tác với MongoDB
		@InjectRepository(Comment, 'mongodb')
		private readonly commentRepository: Repository<Comment>,

		// Service dùng để lấy thông tin người dùng
		private readonly userService: UserService,

		// Service dùng để kiểm tra bài viết và cập nhật số lượng comment
		private readonly postService: PostService,

		// Service dùng để tạo thông báo khi có comment/reaction
		private readonly notificationService: NotificationService,
	) { }

	/**
	 * Kiểm tra một chuỗi có phải ObjectId hợp lệ của MongoDB hay không.
	 */
	private isValidObjectId(value: string) {
		return ObjectId.isValid(String(value || ''));
	}

	/**
	 * Tìm bình luận theo id.
	 * Nếu id không hợp lệ thì trả về null để tránh lỗi MongoDB.
	 */
	private async findCommentById(commentId: string) {
		if (!this.isValidObjectId(commentId)) return null;

		return this.commentRepository.findOne({
			where: {
				_id: new ObjectId(commentId) as any
			}
		});
	}

	/**
	 * Lấy cấu hình S3 từ biến môi trường.
	 * Hỗ trợ nhiều tên biến môi trường khác nhau để dễ deploy.
	 */
	private getS3Config() {
		const bucket =
			process.env.AWS_S3_BUCKET ||
			process.env.AWS_BUCKET_NAME ||
			process.env.S3_BUCKET ||
			'';

		const region =
			process.env.AWS_REGION ||
			process.env.AWS_DEFAULT_REGION ||
			'ap-southeast-1';

		return { bucket, region };
	}

	/**
	 * Tạo S3 client để upload ảnh lên AWS S3.
	 * Nếu có access key và secret key thì dùng credentials.
	 * Nếu không có thì AWS SDK sẽ tự tìm credentials mặc định.
	 */
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

	/**
	 * Làm sạch tên file trước khi lưu.
	 * Tránh ký tự đặc biệt gây lỗi đường dẫn hoặc lỗi URL.
	 */
	private safeFileName(name: string) {
		const ext = path.extname(name || '').slice(0, 24);

		const base =
			path
				.basename(name || 'comment-image', ext)
				.replace(/[^a-zA-Z0-9-_]/g, '-')
				.slice(0, 64) || 'comment-image';

		return `${Date.now()}-${base}${ext}`;
	}

	/**
	 * Chuyển dữ liệu comment trong database sang format trả về cho frontend.
	 * Đồng thời lấy thêm thông tin người viết comment.
	 */
	private async mapComment(row: any, viewerUserId?: number) {
		const author = await this.userService.findOne(row.userId);

		return {
			id: String(row._id),
			postId: row.postId,
			parentCommentId: row.parentCommentId || null,
			userId: row.userId,

			// Thông tin tác giả comment
			authorName: author?.displayName || 'Nguoi dung',
			authorAvatar: author?.avatarUrl || null,
			authorRole: author?.role || 'USER',

			// Nội dung comment
			content: row.content || '',

			// Ảnh đính kèm trong comment
			imageUrl: row.file || null,
			file: row.file || null,

			// Trạng thái comment: visible, deleted,...
			status: row.status,

			// Tổng số reaction của comment
			reactionCount: (row.reactions || []).length,

			// Reaction của người đang xem đối với comment này
			viewerReaction:
				(row.reactions || [])
					.find((r: any) => Number(r.userId) === Number(viewerUserId))
					?.type || null,

			// Danh sách phản hồi sẽ được gắn thêm ở bước xử lý sau
			replies: [],

			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	}

	/**
	 * Lấy danh sách bình luận của một bài viết.
	 * Có hỗ trợ phân trang bằng limit và offset.
	 */
	async listPostComments(postId: string, viewerUserId?: number, limit = 20, offset = 0) {
		// Lấy toàn bộ comment của bài viết, sắp xếp theo thời gian tăng dần
		const rows = await this.commentRepository.find({
			where: { postId } as any,
			order: { createdAt: 'ASC' },
		});

		// Chỉ lấy các comment đang hiển thị
		const visibleRows = (rows as any[]).filter((row) => row.status === 'visible');

		// Chuẩn hóa offset để không bị âm
		const safeOffset = Math.max(Number(offset || 0), 0);

		// Giới hạn limit từ 1 đến 50 để tránh lấy quá nhiều dữ liệu
		const safeLimit = Math.min(Math.max(Number(limit || 20), 1), 50);

		// Convert từng comment sang format frontend cần
		const mapped = await Promise.all(
			visibleRows.map((row) => this.mapComment(row, viewerUserId))
		);

		// Map dùng để gom comment theo parentCommentId
		const byParent = new Map<string, any[]>();

		// Nếu comment không có parentCommentId thì là comment cấp 1
		for (const comment of mapped) {
			const parentKey = comment.parentCommentId ? String(comment.parentCommentId) : '';
			byParent.set(parentKey, [...(byParent.get(parentKey) || []), comment]);
		}

		// Hàm đệ quy để gắn replies vào comment cha
		const attachReplies = (comment: any): any => ({
			...comment,
			replies: (byParent.get(String(comment.id)) || []).map(attachReplies),
		});

		// Lấy danh sách comment cấp cao nhất
		const topLevel = (byParent.get('') || []).map(attachReplies);

		// Áp dụng phân trang
		const comments = topLevel.slice(safeOffset, safeOffset + safeLimit);

		return {
			comments,
			total: topLevel.length,
			limit: safeLimit,
			offset: safeOffset,
			hasMore: safeOffset + comments.length < topLevel.length,
		};
	}

	/**
	 * Tạo bình luận mới cho bài viết.
	 */
	async createComment(
		actorId: number,
		postId: string,
		content: string,
		parentCommentId?: string | null,
		imageUrl?: string | null
	) {
		// Kiểm tra bài viết có tồn tại hay không
		await this.postService.getPostById(postId);

		// Chuẩn hóa nội dung comment
		const normalizedContent = String(content || '').trim();

		// Chuẩn hóa đường dẫn ảnh nếu có
		const normalizedImageUrl = imageUrl ? String(imageUrl).trim() : null;

		// Chuẩn hóa id comment cha nếu đây là reply
		const normalizedParentId = parentCommentId ? String(parentCommentId).trim() : null;

		// Comment phải có ít nhất nội dung hoặc ảnh
		if (!normalizedContent && !normalizedImageUrl) {
			throw new BadRequestException('Binh luan can co noi dung hoac anh');
		}

		// Nếu là reply thì phải kiểm tra comment cha tồn tại và thuộc đúng bài viết
		if (normalizedParentId) {
			const parent = await this.findCommentById(normalizedParentId);

			if (!parent || parent.status !== 'visible' || String(parent.postId) !== String(postId)) {
				throw new NotFoundException('Khong tim thay binh luan cha');
			}
		}

		const now = new Date();

		// Tạo comment mới trong database
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

		// Tăng số lượng comment của bài viết
		await this.postService.increaseCommentCount(postId);

		// Lấy lại thông tin bài viết để gửi notification và emit socket
		const post = await this.postService.getPostById(postId);

		// Nếu người comment không phải chủ bài viết thì gửi thông báo cho chủ bài viết
		if (Number(post.authorId) !== Number(actorId)) {
			const actor = await this.userService.findOne(actorId);

			await this.notificationService.createNotification({
				userId: Number(post.authorId),
				type: 'comment',
				title: `${actor?.displayName || 'Mot nguoi dung'} da binh luan bai viet`,
				body: (normalizedContent || 'Da gui anh trong binh luan').slice(0, 120),
				meta: {
					postId,
					commentId: String((row as any)._id),
					actorId
				},
			});
		}

		// Convert comment vừa tạo sang format trả về frontend
		const comment = await this.mapComment(row, actorId);

		// Emit socket event để client realtime cập nhật comment mới
		emitSocialEvent('comment:created', {
			postId,
			parentCommentId: normalizedParentId,
			actorId,
			comment,
			commentCount: Number(post.commentCount || 0),
		});

		return { comment };
	}

	/**
	 * Tạo phản hồi cho một bình luận có sẵn.
	 */
	async createReply(
		actorId: number,
		parentCommentId: string,
		content: string,
		imageUrl?: string | null
	) {
		// Tìm comment cha
		const parent = await this.findCommentById(parentCommentId);

		// Comment cha phải tồn tại và đang hiển thị
		if (!parent || parent.status !== 'visible') {
			throw new NotFoundException('Khong tim thay binh luan cha');
		}

		// Gọi lại createComment để tái sử dụng logic tạo comment
		return this.createComment(actorId, parent.postId, content, parentCommentId, imageUrl);
	}

	/**
	 * Upload ảnh bình luận từ base64.
	 * Nếu có cấu hình S3 thì upload lên S3.
	 * Nếu không có S3 thì lưu local vào thư mục uploads/comments.
	 */
	async uploadCommentBase64(
		actorId: number,
		body: {
			fileName: string;
			contentType: string;
			base64Data: string;
		}
	) {
		// Kiểm tra dữ liệu base64 có được gửi lên hay không
		if (!body?.base64Data) {
			throw new BadRequestException('Thieu du lieu anh binh luan');
		}

		// Lấy content type, mặc định là application/octet-stream
		const contentType = body.contentType || 'application/octet-stream';

		// Chỉ cho phép upload file ảnh
		if (!contentType.startsWith('image/')) {
			throw new BadRequestException('Binh luan chi ho tro tep anh');
		}

		// Hỗ trợ cả dạng base64 thuần và dạng data URL
		const rawBase64 = String(body.base64Data).includes(',')
			? String(body.base64Data).split(',').pop() || ''
			: String(body.base64Data);

		// Convert base64 sang Buffer để lưu file
		const buffer = Buffer.from(rawBase64, 'base64');

		// Tạo tên file an toàn
		const outputName = this.safeFileName(body.fileName || 'comment-image');

		// Lấy cấu hình S3
		const { bucket, region } = this.getS3Config();

		// Nếu có bucket thì upload lên AWS S3
		if (bucket) {
			const key = `uploads/comments/${actorId}/${outputName}`;

			await this.getS3Client().send(new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				Body: buffer,
				ContentType: contentType,
			}));

			return {
				mediaUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}`
			};
		}

		// Nếu không có S3 thì lưu ảnh vào thư mục local
		const outputDir = path.join(
			process.cwd(),
			'uploads',
			'comments',
			String(actorId)
		);

		// Tạo thư mục nếu chưa tồn tại
		await fs.promises.mkdir(outputDir, { recursive: true });

		// Ghi file ảnh xuống ổ đĩa
		await fs.promises.writeFile(path.join(outputDir, outputName), buffer);

		// Trả về đường dẫn local để frontend hiển thị
		return {
			mediaUrl: `/uploads/comments/${actorId}/${outputName}`
		};
	}

	/**
	 * Thả cảm xúc cho bình luận.
	 * Mỗi user chỉ có một reaction trên một comment.
	 */
	async reactComment(actorId: number, commentId: string, type: string) {
		// Tìm comment cần thả cảm xúc
		const row = await this.findCommentById(commentId);

		// Comment phải tồn tại và đang hiển thị
		if (!row || row.status !== 'visible') {
			throw new NotFoundException('Khong tim thay binh luan');
		}

		// Xóa reaction cũ của user hiện tại nếu có
		row.reactions = (row.reactions || []).filter(
			(item: any) => Number(item.userId) !== Number(actorId)
		);

		// Thêm reaction mới
		row.reactions.push({
			userId: actorId,
			type: type || 'like',
			createdAt: new Date()
		});

		// Cập nhật thời gian chỉnh sửa
		row.updatedAt = new Date();

		// Lưu lại comment
		await this.commentRepository.save(row);

		// Emit socket event để frontend realtime cập nhật reaction
		emitSocialEvent('comment:reaction', {
			postId: row.postId,
			commentId,
			actorId,
			reaction: type || 'like',
			reactionCount: (row.reactions || []).length,
		});

		// Nếu người thả cảm xúc không phải chủ comment thì gửi thông báo
		if (Number(row.userId) !== Number(actorId)) {
			const actor = await this.userService.findOne(actorId);

			await this.notificationService.createNotification({
				userId: Number(row.userId),
				type: 'like',
				title: `${actor?.displayName || 'Mot nguoi dung'} da tha cam xuc binh luan`,
				body: String(row.content || '').slice(0, 120),
				meta: {
					postId: row.postId,
					commentId,
					actorId,
					reaction: type || 'like'
				},
			});
		}

		return {
			message: 'Da cap nhat tuong tac binh luan',
			comment: await this.mapComment(row, actorId)
		};
	}

	/**
	 * Gỡ reaction của user hiện tại khỏi comment.
	 */
	async removeCommentReaction(actorId: number, commentId: string) {
		// Tìm comment cần gỡ reaction
		const row = await this.findCommentById(commentId);

		// Comment phải tồn tại và đang hiển thị
		if (!row || row.status !== 'visible') {
			throw new NotFoundException('Khong tim thay binh luan');
		}

		// Xóa reaction của user hiện tại
		row.reactions = (row.reactions || []).filter(
			(item: any) => Number(item.userId) !== Number(actorId)
		);

		// Cập nhật thời gian chỉnh sửa
		row.updatedAt = new Date();

		// Lưu thay đổi vào database
		await this.commentRepository.save(row);

		// Emit socket event để frontend cập nhật số lượng reaction
		emitSocialEvent('comment:reaction', {
			postId: row.postId,
			commentId,
			actorId,
			reaction: null,
			reactionCount: (row.reactions || []).length,
		});

		return {
			message: 'Da go tuong tac binh luan',
			comment: await this.mapComment(row, actorId)
		};
	}

	/**
	 * Xóa bình luận.
	 * Người được quyền xóa:
	 * - Chủ comment
	 * - Chủ bài viết
	 * - Admin
	 * - Moderator
	 */
	async deleteComment(actor: any, commentId: string) {
		// Lấy id người thực hiện hành động
		const actorId = Number(actor?.id || actor?.userId || actor || 0);

		// Lấy role người thực hiện hành động
		const actorRole = String(actor?.role || '').toLowerCase();

		// Admin hoặc moderator có quyền kiểm duyệt
		const canModerate = actorRole === 'admin' || actorRole === 'moderator';

		// Tìm comment cần xóa
		const row = await this.findCommentById(commentId);

		// Nếu không tìm thấy comment thì báo lỗi
		if (!row) {
			throw new NotFoundException('Khong tim thay binh luan');
		}

		// Nếu comment đã bị xóa trước đó
		if (row.status !== 'visible') {
			// Admin/moderator được trả về thông báo đã xử lý
			if (canModerate) {
				return {
					message: 'Binh luan da duoc xu ly truoc do',
					alreadyDeleted: true
				};
			}

			// User thường thì xem như không tìm thấy
			throw new NotFoundException('Khong tim thay binh luan');
		}

		// Lấy thông tin bài viết chứa comment
		const post = await this.postService.getPostById(row.postId);

		// Kiểm tra quyền xóa comment
		if (
			Number(row.userId) !== Number(actorId) &&
			Number(post.authorId) !== Number(actorId) &&
			!canModerate
		) {
			throw new ForbiddenException('Bạn không có quyền xóa bình luận này');
		}

		// Không xóa cứng khỏi database, chỉ đổi trạng thái sang deleted
		row.status = 'deleted';

		// Cập nhật thời gian chỉnh sửa
		row.updatedAt = new Date();

		// Lưu trạng thái mới
		await this.commentRepository.save(row);

		// Giảm số lượng comment của bài viết
		await this.postService.decreaseCommentCount(row.postId);

		// Lấy lại bài viết sau khi giảm comment count
		const updatedPost = await this.postService.getPostById(row.postId);

		// Emit socket event để frontend realtime xóa comment khỏi giao diện
		emitSocialEvent('comment:deleted', {
			postId: row.postId,
			commentId,
			actorId,
			commentCount: Number(updatedPost.commentCount || 0),
		});

		return {
			message: 'Đã xóa bình luận'
		};
	}
}