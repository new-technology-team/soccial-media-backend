import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import * as fs from "fs";
import * as path from "path";

import { CreatePostDto } from "./dto/create-post.dto";
import { Post } from "./post.entity";
import { User } from "../user/user.entity";
import { Comment } from "../comment/comment.entity";
import { SavedPost } from "./saved-post.entity";
import { NotificationService } from "../notification/notification.service";
import { emitSocialEvent } from "../../common/socket/chat-socket";

/**
 * Kiểu dữ liệu tham số truy vấn dành cho admin khi lấy danh sách bài viết
 * 
 * @property q - Từ khóa tìm kiếm theo nội dung hoặc tên tác giả
 * @property status - Lọc theo trạng thái: 'published' | 'hidden' | 'deleted'
 * @property visibility - Lọc theo phạm vi: 'public' | 'friends' | 'private'
 * @property limit - Số lượng bài viết tối đa trả về (mặc định 200, tối đa 500)
 */
type AdminPostQuery = {
    q?: string;
    status?: string;
    visibility?: string;
    limit?: number;
};

/**
 * PostService - Xử lý toàn bộ logic nghiệp vụ liên quan đến bài viết
 *
 * Bao gồm:
 * - CRUD bài viết (tạo, đọc, sửa, xóa)
 * - Quản lý reaction (like, love, ...)
 * - Upload media lên S3 hoặc local storage
 * - Lưu / bỏ lưu bài viết
 * - Quản lý bài viết dành cho admin
 * - Phát sự kiện realtime qua Socket.IO
 */
@Injectable()
export class PostService {

    /**
     * Khởi tạo service với các repository và service được inject
     * 
     * @param postsRepository - Repository Post trên MongoDB
     * @param commentsRepository - Repository Comment trên MongoDB
     * @param usersRepository - Repository User trên MariaDB
     * @param savedPostsRepository - Repository SavedPost trên MariaDB
     * @param notificationService - Service gửi thông báo
     */
    constructor(
        @InjectRepository(Post, 'mongodb')
        private readonly postsRepository: Repository<Post>,
        @InjectRepository(Comment, 'mongodb')
        private readonly commentsRepository: Repository<Comment>,
        @InjectRepository(User, 'mariadb')
        private readonly usersRepository: Repository<User>,
        @InjectRepository(SavedPost, 'mariadb')
        private readonly savedPostsRepository: Repository<SavedPost>,
        private readonly notificationService: NotificationService,
    ) { }

    /**
     * Kiểm tra quyền admin, ném ForbiddenException nếu không phải admin
     * 
     * @param actor - Thông tin người dùng cần kiểm tra
     * @throws ForbiddenException nếu role không phải 'admin'
     */
    private assertAdmin(actor: any) {
        if (String(actor?.role || '').toLowerCase() !== 'admin') {
            throw new ForbiddenException('Chỉ admin mới có quyền truy cập');
        }
    }

    /**
     * Lấy cấu hình S3 từ biến môi trường
     * Hỗ trợ nhiều tên biến khác nhau để tương thích với nhiều môi trường
     * 
     * @returns Object chứa tên bucket và region của S3
     */
    private getS3Config() {
        const bucket = process.env.AWS_S3_BUCKET || process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET || '';
        const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-1';
        return { bucket, region };
    }

    /**
     * Khởi tạo S3Client với credentials từ biến môi trường
     * Nếu không có credentials thì dùng IAM role mặc định (khi chạy trên EC2/ECS)
     * 
     * @returns Instance S3Client đã được cấu hình
     */
    private getS3Client() {
        const { region } = this.getS3Config();
        return new S3Client({
            region,
            credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
                ? {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    // sessionToken dùng khi sử dụng AWS STS (temporary credentials)
                    sessionToken: process.env.AWS_SESSION_TOKEN || undefined,
                }
                : undefined, // Dùng IAM role mặc định nếu không có credentials
        });
    }

    /**
     * Tạo tên file an toàn cho việc upload, tránh ký tự đặc biệt và trùng tên
     * Format: {timestamp}-{tên-file-đã-làm-sạch}{phần-mở-rộng}
     * 
     * @param name - Tên file gốc từ client
     * @returns Tên file đã được làm sạch và thêm timestamp
     */
    private safeFileName(name: string) {
        const ext = path.extname(name || '').slice(0, 24);
        // Thay thế ký tự không hợp lệ bằng dấu gạch ngang, giới hạn 64 ký tự
        const base = path.basename(name || 'upload', ext).replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 64) || 'upload';
        return `${Date.now()}-${base}${ext}`;
    }

    /**
     * Trích xuất S3 key từ URL đầy đủ của file
     * Hỗ trợ cả format URL virtual-hosted-style và path-style
     * 
     * @param fileUrl - URL đầy đủ của file trên S3
     * @returns S3 key của file, hoặc null nếu không thể trích xuất
     * 
     * @example
     * // Virtual-hosted-style: https://my-bucket.s3.amazonaws.com/uploads/file.jpg
     * // Path-style: https://s3.amazonaws.com/my-bucket/uploads/file.jpg
     */
    private extractS3Key(fileUrl: string | null | undefined) {
        if (!fileUrl) return null;
        const { bucket } = this.getS3Config();
        if (!bucket) return null;

        try {
            const url = new URL(fileUrl);
            // Kiểm tra virtual-hosted-style URL
            if (url.hostname === `${bucket}.s3.amazonaws.com` || url.hostname.startsWith(`${bucket}.s3.`)) {
                return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
            }

            // Kiểm tra path-style URL
            const pathParts = url.pathname.replace(/^\/+/, '').split('/');
            if (pathParts[0] === bucket) {
                return decodeURIComponent(pathParts.slice(1).join('/'));
            }
        } catch {
            return null;
        }

        return null;
    }

    /**
     * Xóa file media khỏi S3 hoặc local storage
     * Tự động phát hiện loại storage dựa trên URL của file
     * 
     * @param fileUrl - URL của file cần xóa
     *   - Nếu là S3 URL → xóa object trên S3
     *   - Nếu là đường dẫn /uploads/ → xóa file local (chỉ trong thư mục uploads)
     */
    private async deleteMediaUrl(fileUrl: string | null | undefined) {
        if (!fileUrl) return;

        // Thử xóa trên S3 trước
        const key = this.extractS3Key(fileUrl);
        const { bucket } = this.getS3Config();
        if (key && bucket) {
            await this.getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
            return;
        }

        // Nếu là file local, xóa an toàn trong thư mục uploads
        if (fileUrl.startsWith('/uploads/')) {
            const resolved = path.resolve(process.cwd(), fileUrl.replace(/^\/+/, ''));
            const uploadsRoot = path.resolve(process.cwd(), 'uploads');
            // Kiểm tra path traversal attack: đảm bảo file nằm trong thư mục uploads
            if (resolved.startsWith(uploadsRoot) && fs.existsSync(resolved)) {
                await fs.promises.unlink(resolved).catch(() => undefined);
            }
        }
    }

    /**
     * Chuyển đổi dữ liệu thô từ DB thành object bài viết chuẩn để trả về client
     * Bao gồm thông tin tác giả, số lượng reaction, trạng thái reaction của viewer
     * 
     * @param row - Dữ liệu bài viết thô từ MongoDB
     * @param viewerUserId - ID người đang xem (để xác định reaction của họ)
     * @returns Object bài viết đã được format chuẩn
     */
    private async toFeedPost(row: any, viewerUserId?: number) {
        // Lấy thông tin tác giả từ MariaDB
        const author = await this.usersRepository.findOne({ where: { userId: row.authorId } });
        // Lấy thông tin bài gốc nếu đây là bài chia sẻ (share)
        const sharedPost = row.sharedPostId ? await this.toSharedPostPreview(row.sharedPostId) : null;

        return {
            id: String(row._id),
            authorId: row.authorId,
            authorName: author?.displayName || 'Nguoi dung',
            authorAvatar: author?.avatarUrl || null,
            authorRole: author?.role || 'USER',
            authorAccountStatus: author?.status || 'ACTIVE',
            content: row.content || '',
            mediaUrl: row.mediaUrl || null,
            sharedPostId: row.sharedPostId || null,
            sharedPost,
            visibility: row.visibility,
            status: row.status,
            reactionCount: (row.reactions || []).length,
            commentCount: Number(row.commentCount || 0),
            // Tìm reaction của viewer trong danh sách reactions, null nếu chưa react
            viewerReaction: (row.reactions || []).find((r: any) => Number(r.userId) === Number(viewerUserId))?.type || null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    /**
     * Tạo preview rút gọn cho bài viết gốc khi bài viết được chia sẻ (share)
     * Trả về { unavailable: true } nếu bài gốc đã bị xóa hoặc không tồn tại
     * 
     * @param postId - ID của bài viết gốc
     * @returns Object preview của bài viết gốc
     */
    private async toSharedPostPreview(postId: string) {
        try {
            const original = await this.postsRepository.findOne({ where: { _id: new ObjectId(postId) as any } as any });

            // Bài gốc không tồn tại hoặc đã bị xóa
            if (!original || (original as any).status === 'deleted') {
                return { id: postId, unavailable: true };
            }

            const author = await this.usersRepository.findOne({ where: { userId: (original as any).authorId } });
            return {
                id: String((original as any)._id),
                authorId: (original as any).authorId,
                authorName: author?.displayName || 'Nguoi dung',
                authorAvatar: author?.avatarUrl || null,
                content: (original as any).content || '',
                mediaUrl: (original as any).mediaUrl || null,
                reactionCount: ((original as any).reactions || []).length,
                commentCount: Number((original as any).commentCount || 0),
                createdAt: (original as any).createdAt,
                // Đánh dấu không khả dụng nếu bài gốc không còn ở trạng thái published
                unavailable: (original as any).status !== 'published',
            };
        } catch (_error) {
            // Lỗi khi parse ObjectId hoặc lỗi DB → trả về unavailable
            return { id: postId, unavailable: true };
        }
    }

    /**
     * Tạo bài viết mới (API cũ, dùng CreatePostDto)
     * 
     * @param createPostDto - DTO chứa thông tin bài viết cần tạo
     * @returns Bài viết vừa được lưu vào MongoDB
     * @throws Error nếu không tìm thấy user với ownerId
     */
    async createPost(createPostDto: CreatePostDto): Promise<Post> {
        const user = await this.usersRepository.findOne({ where: { userId: createPostDto.ownerId } });
        if (!user) {
            throw new Error("User not found");
        }

        return this.postsRepository.save(this.postsRepository.create({
            content: createPostDto.content,
            mediaUrl: null,
            visibility: 'public',
            status: 'published',
            authorId: user.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            reactions: [],
            commentCount: 0,
        }));
    }

    /**
     * Lấy danh sách bài viết trên feed (trang chủ)
     * Sắp xếp theo thời gian mới nhất, giới hạn tối đa 100 bài mỗi lần
     * 
     * @param viewerUserId - ID người đang xem (để hiển thị reaction của họ)
     * @param includeHidden - Có bao gồm bài viết bị ẩn không (mặc định false)
     * @param limit - Số bài tối đa (mặc định 40, tối đa 100)
     * @returns { posts: [...] } danh sách bài viết đã được format
     */
    async listFeed(viewerUserId?: number, includeHidden = false, limit = 40) {
        const rows = await this.postsRepository.find({
            order: { createdAt: 'DESC' },
            take: Math.min(Math.max(Number(limit || 40), 1), 100), // Giới hạn 1-100 bài
        });

        const posts: any[] = [];
        for (const row of rows as any[]) {
            // Bỏ qua bài chưa published nếu không yêu cầu bao gồm bài ẩn
            if (!includeHidden && row.status !== 'published') continue;
            posts.push(await this.toFeedPost(row, viewerUserId));
        }

        return { posts };
    }

    /**
     * Lấy danh sách bài viết của một người dùng cụ thể
     * Chỉ trả về bài đang ở trạng thái 'published'
     * 
     * @param authorId - ID tác giả cần xem bài viết
     * @param viewerUserId - ID người đang xem
     * @param limit - Số bài tối đa (mặc định 20, tối đa 100)
     * @returns { posts: [...] } danh sách bài viết của tác giả
     */
    async listUserPosts(authorId: number, viewerUserId?: number, limit = 20) {
        const rows = await this.postsRepository.find({
            where: { authorId } as any,
            order: { createdAt: 'DESC' },
            take: Math.min(Math.max(Number(limit || 20), 1), 100),
        });

        const posts: any[] = [];
        for (const row of rows as any[]) {
            if (row.status !== 'published') continue; // Chỉ lấy bài đã published
            posts.push(await this.toFeedPost(row, viewerUserId));
        }

        return { posts };
    }

    /**
     * Tạo bài viết mới trên feed (API mới)
     * Sau khi tạo sẽ phát sự kiện 'post:created' qua Socket.IO để cập nhật realtime
     * 
     * @param actorId - ID người tạo bài viết
     * @param body - Dữ liệu bài viết: content, mediaUrl, sharedPostId, visibility
     * @returns { post: {...} } bài viết vừa được tạo
     * @throws BadRequestException nếu không có content, mediaUrl, hoặc sharedPostId
     */
    async createFeedPost(actorId: number, body: any) {
        // Bài viết phải có ít nhất một trong: nội dung, media, hoặc là bài chia sẻ
        if (!body?.content && !body?.mediaUrl && !body?.sharedPostId) {
            throw new BadRequestException('Bai viet can co noi dung hoac media');
        }

        const row = await this.postsRepository.save(this.postsRepository.create({
            content: body?.content || '',
            mediaUrl: body?.mediaUrl || null,
            sharedPostId: body?.sharedPostId ? String(body.sharedPostId) : null,
            visibility: body?.visibility || 'public', // Mặc định public nếu không chỉ định
            status: 'published',
            authorId: actorId,
            createdAt: new Date(),
            updatedAt: new Date(),
            reactions: [],
            commentCount: 0,
        }));

        const post = await this.toFeedPost(row, actorId);
        // Phát sự kiện realtime để client cập nhật feed ngay lập tức
        emitSocialEvent('post:created', { post, actorId });
        return { post };
    }

    /**
     * Tìm bài viết theo ID, ném NotFoundException nếu không tồn tại
     * Đây là helper method dùng chung cho nhiều function khác
     * 
     * @param postId - ID bài viết (MongoDB ObjectId dạng string)
     * @returns Dữ liệu bài viết thô từ MongoDB
     * @throws NotFoundException nếu không tìm thấy bài viết
     */
    async getPostById(postId: string) {
        const row = await this.postsRepository.findOne({ where: { _id: new ObjectId(postId) as any } as any });
        if (!row) {
            throw new NotFoundException('Khong tim thay bai viet');
        }
        return row as any;
    }

    /**
     * Lấy chi tiết một bài viết theo ID, kèm thông tin tác giả và reaction
     * 
     * @param postId - ID bài viết cần xem
     * @param viewerUserId - ID người đang xem (để xác định reaction của họ)
     * @returns { post: {...} } chi tiết bài viết đã được format
     */
    async getFeedPost(postId: string, viewerUserId?: number) {
        const row = await this.getPostById(postId);
        return { post: await this.toFeedPost(row, viewerUserId) };
    }

    /**
     * Lấy danh sách bài viết cho admin với bộ lọc nâng cao
     * Chỉ admin mới có quyền gọi API này
     * 
     * @param actor - Thông tin admin đang đăng nhập
     * @param query - Tham số lọc: q (tìm kiếm), status, visibility, limit
     * @returns { posts: [...] } danh sách bài viết phù hợp điều kiện lọc
     * @throws ForbiddenException nếu không phải admin
     */
    async listAdminPosts(actor: any, query: AdminPostQuery = {}) {
        this.assertAdmin(actor);

        // Chuẩn hóa các tham số tìm kiếm về lowercase để so sánh không phân biệt hoa thường
        const normalizedQuery = String(query.q || '').trim().toLowerCase();
        const normalizedStatus = String(query.status || '').trim().toLowerCase();
        const normalizedVisibility = String(query.visibility || '').trim().toLowerCase();
        const safeLimit = Math.min(Math.max(Number(query.limit || 200), 1), 500); // Giới hạn 1-500

        const rows = await this.postsRepository.find({ order: { createdAt: 'DESC' } });
        const posts: any[] = [];

        for (const row of rows as any[]) {
            const post = await this.toFeedPost(row, actor?.id);

            // Kiểm tra từng điều kiện lọc, bỏ qua nếu không truyền điều kiện đó
            const matchesStatus = !normalizedStatus || String(post.status || '').toLowerCase() === normalizedStatus;
            const matchesVisibility = !normalizedVisibility || String(post.visibility || '').toLowerCase() === normalizedVisibility;
            const matchesQuery = !normalizedQuery ||
                String(post.content || '').toLowerCase().includes(normalizedQuery) ||
                String(post.authorName || '').toLowerCase().includes(normalizedQuery);

            if (matchesStatus && matchesVisibility && matchesQuery) {
                posts.push(post);
            }

            // Dừng sớm khi đã đủ số lượng để tránh xử lý toàn bộ collection
            if (posts.length >= safeLimit) {
                break;
            }
        }

        return { posts };
    }

    /**
     * Admin cập nhật trạng thái hoặc phạm vi hiển thị của bài viết
     * Dùng để ẩn/hiện bài viết vi phạm, thay đổi visibility
     * 
     * @param actor - Thông tin admin đang đăng nhập
     * @param postId - ID bài viết cần cập nhật
     * @param body - Dữ liệu cập nhật: visibility, status
     * @returns { message, post } thông báo và bài viết sau khi cập nhật
     * @throws ForbiddenException nếu không phải admin
     */
    async updateAdminPost(actor: any, postId: string, body: any) {
        this.assertAdmin(actor);

        const row = await this.getPostById(postId);
        // Giữ nguyên giá trị cũ nếu không truyền giá trị mới
        const nextVisibility = body?.visibility ? String(body.visibility) : row.visibility || 'public';
        const nextStatus = body?.status ? String(body.status) : row.status || 'published';
        row.visibility = nextVisibility;
        row.status = nextStatus;
        row.updatedAt = new Date();
        await this.postsRepository.save(row);

        return { message: 'Đã cập nhật bài viết', post: await this.toFeedPost(row, actor?.id) };
    }

    /**
     * Admin xóa mềm (soft delete) bài viết vi phạm
     * Không xóa thật ra khỏi DB mà chỉ đổi status thành 'deleted'
     * Phát sự kiện 'post:deleted' qua Socket.IO để client cập nhật realtime
     * 
     * @param actor - Thông tin admin đang đăng nhập
     * @param postId - ID bài viết cần xóa
     * @returns { message, post } thông báo và bài viết đã bị xóa
     * @throws ForbiddenException nếu không phải admin
     */
    async deleteAdminPost(actor: any, postId: string) {
        this.assertAdmin(actor);

        const row = await this.getPostById(postId);
        row.status = 'deleted'; // Soft delete: chỉ đổi status, không xóa khỏi DB
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        emitSocialEvent('post:deleted', { postId, actorId: actor?.id || null });

        return { message: 'Đã xóa bài viết', post: await this.toFeedPost(row, actor?.id) };
    }

    /**
     * Upload ảnh/video cho bài viết dưới dạng Base64
     * Ưu tiên upload lên S3 nếu có cấu hình, fallback về local storage
     * 
     * @param actorId - ID người dùng upload
     * @param body - Object chứa: fileName, contentType, base64Data
     * @returns { message, mediaUrl } URL của file sau khi upload thành công
     * @throws BadRequestException nếu thiếu dữ liệu Base64 hoặc S3 upload thất bại
     */
    async uploadPostBase64(actorId: number, body: { fileName: string; contentType: string; base64Data: string }) {
        if (!body?.base64Data) {
            throw new BadRequestException('Thieu du lieu anh hoac video');
        }

        // Tách phần data thực từ Data URL (vd: "data:image/png;base64,iVBORw0...")
        const rawBase64 = String(body.base64Data).includes(',')
            ? String(body.base64Data).split(',').pop() || ''
            : String(body.base64Data);

        const buffer = Buffer.from(rawBase64, 'base64');
        const contentType = body.contentType || 'application/octet-stream';
        const outputName = this.safeFileName(body.fileName || 'post-media');
        const { bucket, region } = this.getS3Config();

        // Upload lên S3 nếu đã cấu hình bucket
        if (bucket) {
            const key = `uploads/posts/${actorId}/${outputName}`;
            try {
                await this.getS3Client().send(new PutObjectCommand({
                    Bucket: bucket,
                    Key: key,
                    Body: buffer,
                    ContentType: contentType,
                }));
                return {
                    message: 'Da tai media bai viet len S3',
                    mediaUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
                };
            } catch (error) {
                const detail = error instanceof Error ? error.message : 'Lỗi S3 không xác định';
                console.error('S3 post upload failed:', detail);
                throw new BadRequestException(`Không thể tải media bài viết lên S3: ${detail}`);
            }
        }

        // Fallback: Lưu vào local storage nếu không có S3
        const outputDir = path.join(process.cwd(), 'uploads', 'posts', String(actorId));
        await fs.promises.mkdir(outputDir, { recursive: true }); // Tạo thư mục nếu chưa có
        await fs.promises.writeFile(path.join(outputDir, outputName), buffer);
        return {
            message: 'Da tai media bai viet',
            mediaUrl: `/uploads/posts/${actorId}/${outputName}`,
        };
    }

    /**
     * Tăng số lượng comment của bài viết lên 1
     * Được gọi từ CommentService khi có comment mới được tạo
     * 
     * @param postId - ID bài viết cần tăng commentCount
     */
    async increaseCommentCount(postId: string) {
        const row = await this.getPostById(postId);
        row.commentCount = Number(row.commentCount || 0) + 1;
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
    }

    /**
     * Giảm số lượng comment của bài viết xuống 1
     * Được gọi từ CommentService khi comment bị xóa
     * Không để commentCount xuống dưới 0
     * 
     * @param postId - ID bài viết cần giảm commentCount
     */
    async decreaseCommentCount(postId: string) {
        const row = await this.getPostById(postId);
        row.commentCount = Math.max(0, Number(row.commentCount || 0) - 1); // Đảm bảo không âm
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
    }

    /**
     * Chủ bài viết cập nhật nội dung bài của mình
     * Tự động xóa media cũ trên S3/local nếu media được thay đổi
     * Phát sự kiện 'post:updated' qua Socket.IO
     * 
     * @param actorId - ID người thực hiện (phải là chủ bài viết)
     * @param postId - ID bài viết cần cập nhật
     * @param body - Dữ liệu cập nhật: content, mediaUrl, visibility
     * @returns { message, post } thông báo và bài viết sau khi cập nhật
     * @throws ForbiddenException nếu không phải chủ bài viết
     * @throws BadRequestException nếu bài viết rỗng (không có content lẫn media)
     */
    async updateFeedPost(actorId: number, postId: string, body: any) {
        const row = await this.getPostById(postId);

        // Kiểm tra quyền sở hữu bài viết
        if (Number(row.authorId) !== Number(actorId)) {
            throw new ForbiddenException('Bạn không có quyền sửa bài viết này');
        }

        // Dùng giá trị mới nếu được truyền, ngược lại giữ nguyên giá trị cũ
        const nextContent = body?.content !== undefined ? String(body.content || '') : row.content || '';
        const nextMedia = body?.mediaUrl !== undefined ? (body.mediaUrl || null) : row.mediaUrl || null;

        if (!nextContent.trim() && !nextMedia) {
            throw new BadRequestException('Bai viet can co noi dung hoac media');
        }

        // Xóa media cũ nếu người dùng thay đổi hoặc xóa bỏ media
        if (row.mediaUrl && row.mediaUrl !== nextMedia) {
            await this.deleteMediaUrl(row.mediaUrl);
        }

        row.content = nextContent;
        row.mediaUrl = nextMedia;
        row.visibility = body?.visibility || row.visibility || 'public';
        row.updatedAt = new Date();
        await this.postsRepository.save(row);

        const post = await this.toFeedPost(row, actorId);
        emitSocialEvent('post:updated', { post, actorId });
        return { message: 'Đã cập nhật bài viết', post };
    }

    /**
     * Chủ bài viết xóa mềm bài của mình (soft delete)
     * Phát sự kiện 'post:deleted' qua Socket.IO để client cập nhật realtime
     * 
     * @param actorId - ID người thực hiện (phải là chủ bài viết)
     * @param postId - ID bài viết cần xóa
     * @returns { message } thông báo xóa thành công
     * @throws ForbiddenException nếu không phải chủ bài viết
     */
    async deleteFeedPost(actorId: number, postId: string) {
        const row = await this.getPostById(postId);

        // Kiểm tra quyền sở hữu bài viết
        if (Number(row.authorId) !== Number(actorId)) {
            throw new ForbiddenException('Bạn không có quyền xóa bài viết này');
        }

        row.status = 'deleted'; // Soft delete
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        emitSocialEvent('post:deleted', { postId, actorId });
        return { message: 'Da xoa bai viet' };
    }

    /**
     * Thêm hoặc cập nhật reaction của người dùng trên bài viết
     * Nếu đã react trước đó, reaction cũ sẽ bị thay thế bằng reaction mới
     * Gửi thông báo cho chủ bài viết (trừ khi tự react bài của mình)
     * Phát 2 sự kiện Socket.IO: 'post:reactionUpdated' và 'post:reaction'
     * 
     * @param actorId - ID người thực hiện reaction
     * @param postId - ID bài viết cần react
     * @param type - Loại reaction: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry'
     * @returns { message, post } thông báo và bài viết sau khi cập nhật reaction
     */
    async reactPost(actorId: number, postId: string, type: string) {
        const row = await this.getPostById(postId);

        // Xóa reaction cũ của user này (nếu có) trước khi thêm reaction mới
        row.reactions = (row.reactions || []).filter((item: any) => Number(item.userId) !== Number(actorId));
        row.reactions.push({ userId: actorId, type: type || 'like', createdAt: new Date() });
        row.updatedAt = new Date();
        await this.postsRepository.save(row);

        // Phát 2 sự kiện để tương thích với các client đang lắng nghe tên event khác nhau
        emitSocialEvent('post:reactionUpdated', {
            postId,
            actorId,
            reaction: type || 'like',
            reactionCount: (row.reactions || []).length,
            post: await this.toFeedPost(row, actorId),
        });
        emitSocialEvent('post:reaction', {
            postId,
            actorId,
            reaction: type || 'like',
            reactionCount: (row.reactions || []).length,
            post: await this.toFeedPost(row, actorId),
        });

        // Gửi thông báo cho chủ bài viết, không gửi nếu tự react bài của mình
        if (Number(row.authorId) !== Number(actorId)) {
            const actor = await this.usersRepository.findOne({ where: { userId: actorId } });
            await this.notificationService.createNotification({
                userId: Number(row.authorId),
                type: 'like',
                title: `${actor?.displayName || 'Một người dùng'} đã thả cảm xúc bài viết`,
                body: String(row.content || '').slice(0, 120) || 'Bài viết có media mới được tương tác.',
                meta: { postId, actorId, reaction: type || 'like' },
            });
        }

        return { message: 'Da cap nhat tuong tac', post: await this.toFeedPost(row, actorId) };
    }

    /**
     * Lấy danh sách tất cả reaction của một bài viết kèm thông tin người dùng
     * 
     * @param postId - ID bài viết cần xem danh sách reaction
     * @returns { reactions: [...] } danh sách reaction kèm tên, avatar, loại reaction
     */
    async listPostReactions(postId: string) {
        const row = await this.getPostById(postId);
        const reactions: any[] = [];

        for (const reaction of row.reactions || []) {
            // Lấy thông tin người dùng từ MariaDB để hiển thị tên và avatar
            const actor = await this.usersRepository.findOne({ where: { userId: Number(reaction.userId) } });
            reactions.push({
                userId: Number(reaction.userId),
                fullName: actor?.displayName || `Người dùng #${reaction.userId}`,
                avatarUrl: actor?.avatarUrl || null,
                reaction: reaction.type || 'like',
                createdAt: reaction.createdAt || null,
            });
        }

        return { reactions };
    }

    /**
     * Xóa reaction của người dùng khỏi bài viết
     * Phát 2 sự kiện Socket.IO với reaction = null để client cập nhật UI
     * 
     * @param actorId - ID người dùng cần xóa reaction
     * @param postId - ID bài viết cần bỏ reaction
     * @returns { message, post } thông báo và bài viết sau khi xóa reaction
     */
    async removeReaction(actorId: number, postId: string) {
        const row = await this.getPostById(postId);

        // Lọc bỏ reaction của user này khỏi mảng reactions
        row.reactions = (row.reactions || []).filter((item: any) => Number(item.userId) !== Number(actorId));
        row.updatedAt = new Date();
        await this.postsRepository.save(row);

        // Phát 2 sự kiện với reaction = null để báo hiệu reaction đã bị xóa
        emitSocialEvent('post:reactionUpdated', {
            postId,
            actorId,
            reaction: null,
            reactionCount: (row.reactions || []).length,
            post: await this.toFeedPost(row, actorId),
        });
        emitSocialEvent('post:reaction', {
            postId,
            actorId,
            reaction: null,
            reactionCount: (row.reactions || []).length,
            post: await this.toFeedPost(row, actorId),
        });

        return { message: 'Da go tuong tac', post: await this.toFeedPost(row, actorId) };
    }

    /**
     * Kiểm duyệt bài viết bằng cách thay đổi status
     * Dùng nội bộ hoặc từ hệ thống kiểm duyệt tự động
     * Phát sự kiện 'post:updated' qua Socket.IO
     * 
     * @param postId - ID bài viết cần kiểm duyệt
     * @param status - Trạng thái mới: 'published' | 'hidden' | 'deleted'
     * @returns Dữ liệu bài viết thô sau khi cập nhật
     */
    async moderatePost(postId: string, status: string) {
        const row = await this.getPostById(postId);
        row.status = status;
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        // actorId = null vì đây là thao tác hệ thống, không phải người dùng
        emitSocialEvent('post:updated', { post: await this.toFeedPost(row), actorId: null });
        return row;
    }

    /**
     * Lưu bài viết vào danh sách đã lưu của người dùng
     * Dùng INSERT OR IGNORE để tránh lỗi khi đã lưu trước đó (idempotent)
     * 
     * @param userId - ID người dùng
     * @param postId - ID bài viết cần lưu
     */
    async savePost(userId: number, postId: string): Promise<void> {
        await this.savedPostsRepository
            .createQueryBuilder()
            .insert()
            .into(SavedPost)
            .values({ userId, postId })
            .orIgnore() // Bỏ qua nếu đã lưu rồi, không throw error
            .execute();
    }

    /**
     * Bỏ lưu bài viết khỏi danh sách đã lưu của người dùng
     * 
     * @param userId - ID người dùng
     * @param postId - ID bài viết cần bỏ lưu
     */
    async unsavePost(userId: number, postId: string): Promise<void> {
        await this.savedPostsRepository.delete({ userId, postId });
    }

    /**
     * Lấy danh sách bài viết đã lưu của người dùng
     * Bỏ qua bài đã bị xóa hoặc không còn tồn tại, sắp xếp theo thời gian lưu mới nhất
     * 
     * @param userId - ID người dùng cần lấy danh sách bài đã lưu
     * @returns Mảng bài viết đã được format, đã lọc bỏ bài không còn tồn tại
     */
    async listSavedPosts(userId: number): Promise<any[]> {
        const saved = await this.savedPostsRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' }, // Bài lưu mới nhất lên đầu
        });

        // Dùng Promise.all để fetch song song thay vì tuần tự, tăng hiệu năng
        const posts = await Promise.all(
            saved.map(async (s) => {
                try {
                    const row = await this.postsRepository.findOne({ where: { _id: new ObjectId(s.postId) as any } as any });
                    // Bỏ qua bài không tồn tại hoặc đã bị xóa
                    if (!row || (row as any).status === 'deleted') return null;
                    return await this.toFeedPost(row, userId);
                } catch {
                    return null; // Bỏ qua lỗi parse ObjectId hoặc lỗi DB
                }
            })
        );

        // Lọc bỏ các giá trị null (bài không còn tồn tại)
        return posts.filter(Boolean);
    }
}