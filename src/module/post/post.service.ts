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
import { NotificationService } from "../notification/notification.service";
import { emitSocialEvent } from "../../common/socket/chat-socket";

type AdminPostQuery = {
    q?: string;
    status?: string;
    visibility?: string;
    limit?: number;
};

@Injectable()
export class PostService {
    constructor(
        @InjectRepository(Post, 'mongodb')
        private readonly postsRepository: Repository<Post>,
        @InjectRepository(Comment, 'mongodb')
        private readonly commentsRepository: Repository<Comment>,
        @InjectRepository(User, 'mariadb')
        private readonly usersRepository: Repository<User>,
        private readonly notificationService: NotificationService,
    ) { }

    private assertAdmin(actor: any) {
        if (String(actor?.role || '').toLowerCase() !== 'admin') {
            throw new ForbiddenException('Chỉ admin mới có quyền truy cập');
        }
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
        const base = path.basename(name || 'upload', ext).replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 64) || 'upload';
        return `${Date.now()}-${base}${ext}`;
    }

    private extractS3Key(fileUrl: string | null | undefined) {
        if (!fileUrl) return null;
        const { bucket } = this.getS3Config();
        if (!bucket) return null;

        try {
            const url = new URL(fileUrl);
            if (url.hostname === `${bucket}.s3.amazonaws.com` || url.hostname.startsWith(`${bucket}.s3.`)) {
                return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
            }

            const pathParts = url.pathname.replace(/^\/+/, '').split('/');
            if (pathParts[0] === bucket) {
                return decodeURIComponent(pathParts.slice(1).join('/'));
            }
        } catch {
            return null;
        }

        return null;
    }

    private async deleteMediaUrl(fileUrl: string | null | undefined) {
        if (!fileUrl) return;

        const key = this.extractS3Key(fileUrl);
        const { bucket } = this.getS3Config();
        if (key && bucket) {
            await this.getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
            return;
        }

        if (fileUrl.startsWith('/uploads/')) {
            const resolved = path.resolve(process.cwd(), fileUrl.replace(/^\/+/, ''));
            const uploadsRoot = path.resolve(process.cwd(), 'uploads');
            if (resolved.startsWith(uploadsRoot) && fs.existsSync(resolved)) {
                await fs.promises.unlink(resolved).catch(() => undefined);
            }
        }
    }

    private async toFeedPost(row: any, viewerUserId?: number) {
        const author = await this.usersRepository.findOne({ where: { userId: row.authorId } });
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
            viewerReaction: (row.reactions || []).find((r: any) => Number(r.userId) === Number(viewerUserId))?.type || null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    private async toSharedPostPreview(postId: string) {
        try {
            const original = await this.postsRepository.findOne({ where: { _id: new ObjectId(postId) as any } as any });
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
                unavailable: (original as any).status !== 'published',
            };
        } catch (_error) {
            return { id: postId, unavailable: true };
        }
    }

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

    async listFeed(viewerUserId?: number, includeHidden = false, limit = 40) {
        const rows = await this.postsRepository.find({
            order: { createdAt: 'DESC' },
            take: Math.min(Math.max(Number(limit || 40), 1), 100),
        });

        const posts: any[] = [];
        for (const row of rows as any[]) {
            if (!includeHidden && row.status !== 'published') continue;
            posts.push(await this.toFeedPost(row, viewerUserId));
        }

        return { posts };
    }

    async createFeedPost(actorId: number, body: any) {
        if (!body?.content && !body?.mediaUrl && !body?.sharedPostId) {
            throw new BadRequestException('Bai viet can co noi dung hoac media');
        }

        const row = await this.postsRepository.save(this.postsRepository.create({
            content: body?.content || '',
            mediaUrl: body?.mediaUrl || null,
            sharedPostId: body?.sharedPostId ? String(body.sharedPostId) : null,
            visibility: body?.visibility || 'public',
            status: 'published',
            authorId: actorId,
            createdAt: new Date(),
            updatedAt: new Date(),
            reactions: [],
            commentCount: 0,
        }));

        const post = await this.toFeedPost(row, actorId);
        emitSocialEvent('post:created', { post, actorId });
        return { post };
    }

    async getPostById(postId: string) {
        const row = await this.postsRepository.findOne({ where: { _id: new ObjectId(postId) as any } as any });
        if (!row) {
            throw new NotFoundException('Khong tim thay bai viet');
        }
        return row as any;
    }

    async getFeedPost(postId: string, viewerUserId?: number) {
        const row = await this.getPostById(postId);
        return { post: await this.toFeedPost(row, viewerUserId) };
    }

    async listAdminPosts(actor: any, query: AdminPostQuery = {}) {
        this.assertAdmin(actor);

        const normalizedQuery = String(query.q || '').trim().toLowerCase();
        const normalizedStatus = String(query.status || '').trim().toLowerCase();
        const normalizedVisibility = String(query.visibility || '').trim().toLowerCase();
        const safeLimit = Math.min(Math.max(Number(query.limit || 200), 1), 500);

        const rows = await this.postsRepository.find({ order: { createdAt: 'DESC' } });
        const posts: any[] = [];

        for (const row of rows as any[]) {
            const post = await this.toFeedPost(row, actor?.id);
            const matchesStatus = !normalizedStatus || String(post.status || '').toLowerCase() === normalizedStatus;
            const matchesVisibility = !normalizedVisibility || String(post.visibility || '').toLowerCase() === normalizedVisibility;
            const matchesQuery = !normalizedQuery ||
                String(post.content || '').toLowerCase().includes(normalizedQuery) ||
                String(post.authorName || '').toLowerCase().includes(normalizedQuery);

            if (matchesStatus && matchesVisibility && matchesQuery) {
                posts.push(post);
            }

            if (posts.length >= safeLimit) {
                break;
            }
        }

        return { posts };
    }

    async updateAdminPost(actor: any, postId: string, body: any) {
        this.assertAdmin(actor);

        const row = await this.getPostById(postId);
        const nextVisibility = body?.visibility ? String(body.visibility) : row.visibility || 'public';
        const nextStatus = body?.status ? String(body.status) : row.status || 'published';
        row.visibility = nextVisibility;
        row.status = nextStatus;
        row.updatedAt = new Date();
        await this.postsRepository.save(row);

        return { message: 'Đã cập nhật bài viết', post: await this.toFeedPost(row, actor?.id) };
    }

    async deleteAdminPost(actor: any, postId: string) {
        this.assertAdmin(actor);

        const row = await this.getPostById(postId);
        row.status = 'deleted';
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        emitSocialEvent('post:deleted', { postId, actorId: actor?.id || null });

        return { message: 'Đã xóa bài viết', post: await this.toFeedPost(row, actor?.id) };
    }

    async uploadPostBase64(actorId: number, body: { fileName: string; contentType: string; base64Data: string }) {
        if (!body?.base64Data) {
            throw new BadRequestException('Thieu du lieu anh hoac video');
        }

        const rawBase64 = String(body.base64Data).includes(',')
            ? String(body.base64Data).split(',').pop() || ''
            : String(body.base64Data);
        const buffer = Buffer.from(rawBase64, 'base64');
        const contentType = body.contentType || 'application/octet-stream';
        const outputName = this.safeFileName(body.fileName || 'post-media');
        const { bucket, region } = this.getS3Config();

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

        const outputDir = path.join(process.cwd(), 'uploads', 'posts', String(actorId));
        await fs.promises.mkdir(outputDir, { recursive: true });
        await fs.promises.writeFile(path.join(outputDir, outputName), buffer);
        return {
            message: 'Da tai media bai viet',
            mediaUrl: `/uploads/posts/${actorId}/${outputName}`,
        };
    }

    async increaseCommentCount(postId: string) {
        const row = await this.getPostById(postId);
        row.commentCount = Number(row.commentCount || 0) + 1;
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
    }

    async decreaseCommentCount(postId: string) {
        const row = await this.getPostById(postId);
        row.commentCount = Math.max(0, Number(row.commentCount || 0) - 1);
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
    }

    async updateFeedPost(actorId: number, postId: string, body: any) {
        const row = await this.getPostById(postId);
        if (Number(row.authorId) !== Number(actorId)) {
            throw new ForbiddenException('Ban khong co quyen sua bai viet nay');
        }

        const nextContent = body?.content !== undefined ? String(body.content || '') : row.content || '';
        const nextMedia = body?.mediaUrl !== undefined ? (body.mediaUrl || null) : row.mediaUrl || null;
        if (!nextContent.trim() && !nextMedia) {
            throw new BadRequestException('Bai viet can co noi dung hoac media');
        }

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
        return { message: 'Da cap nhat bai viet', post };
    }

    async deleteFeedPost(actorId: number, postId: string) {
        const row = await this.getPostById(postId);
        if (Number(row.authorId) !== Number(actorId)) {
            throw new ForbiddenException('Ban khong co quyen xoa bai viet nay');
        }

        row.status = 'deleted';
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        emitSocialEvent('post:deleted', { postId, actorId });
        return { message: 'Da xoa bai viet' };
    }

    async reactPost(actorId: number, postId: string, type: string) {
        const row = await this.getPostById(postId);
        row.reactions = (row.reactions || []).filter((item: any) => Number(item.userId) !== Number(actorId));
        row.reactions.push({ userId: actorId, type: type || 'like', createdAt: new Date() });
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
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

    async listPostReactions(postId: string) {
        const row = await this.getPostById(postId);
        const reactions: any[] = [];
        for (const reaction of row.reactions || []) {
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

    async removeReaction(actorId: number, postId: string) {
        const row = await this.getPostById(postId);
        row.reactions = (row.reactions || []).filter((item: any) => Number(item.userId) !== Number(actorId));
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
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

    async moderatePost(postId: string, status: string) {
        const row = await this.getPostById(postId);
        row.status = status;
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        emitSocialEvent('post:updated', { post: await this.toFeedPost(row), actorId: null });
        return row;
    }
}
