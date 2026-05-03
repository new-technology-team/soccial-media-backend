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

@Injectable()
export class PostService {
    constructor(
        @InjectRepository(Post, 'mongodb')
        private readonly postsRepository: Repository<Post>,
        @InjectRepository(Comment, 'mongodb')
        private readonly commentsRepository: Repository<Comment>,
        @InjectRepository(User, 'mariadb')
        private readonly usersRepository: Repository<User>,
    ) { }

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
        return {
            id: String(row._id),
            authorId: row.authorId,
            authorName: author?.displayName || 'Nguoi dung',
            authorAvatar: author?.avatarUrl || null,
            authorRole: author?.role || 'USER',
            authorAccountStatus: author?.status || 'ACTIVE',
            content: row.content || '',
            mediaUrl: row.mediaUrl || null,
            visibility: row.visibility,
            status: row.status,
            reactionCount: (row.reactions || []).length,
            commentCount: Number(row.commentCount || 0),
            viewerReaction: (row.reactions || []).find((r: any) => Number(r.userId) === Number(viewerUserId))?.type || null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
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
        if (!body?.content && !body?.mediaUrl) {
            throw new BadRequestException('Bai viet can co noi dung hoac media');
        }

        const row = await this.postsRepository.save(this.postsRepository.create({
            content: body?.content || '',
            mediaUrl: body?.mediaUrl || null,
            visibility: body?.visibility || 'public',
            status: 'published',
            authorId: actorId,
            createdAt: new Date(),
            updatedAt: new Date(),
            reactions: [],
            commentCount: 0,
        }));

        return { post: await this.toFeedPost(row, actorId) };
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
                // Fallback to local storage when S3 credentials/signature are invalid.
                console.warn('S3 upload failed, fallback to local uploads:', error instanceof Error ? error.message : error);
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
        return { message: 'Da cap nhat bai viet', post: await this.toFeedPost(row, actorId) };
    }

    async deleteFeedPost(actorId: number, postId: string) {
        const row = await this.getPostById(postId);
        if (Number(row.authorId) !== Number(actorId)) {
            throw new ForbiddenException('Ban khong co quyen xoa bai viet nay');
        }

        await this.deleteMediaUrl(row.mediaUrl);
        await this.commentsRepository.delete({ postId } as any);
        await this.postsRepository.delete({ _id: new ObjectId(postId) } as any);
        return { message: 'Da xoa bai viet va media lien quan' };
    }

    async reactPost(actorId: number, postId: string, type: string) {
        const row = await this.getPostById(postId);
        row.reactions = (row.reactions || []).filter((item: any) => Number(item.userId) !== Number(actorId));
        row.reactions.push({ userId: actorId, type: type || 'like', createdAt: new Date() });
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        return { message: 'Da cap nhat tuong tac', post: await this.toFeedPost(row, actorId) };
    }

    async removeReaction(actorId: number, postId: string) {
        const row = await this.getPostById(postId);
        row.reactions = (row.reactions || []).filter((item: any) => Number(item.userId) !== Number(actorId));
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        return { message: 'Da go tuong tac', post: await this.toFeedPost(row, actorId) };
    }

    async moderatePost(postId: string, status: string) {
        const row = await this.getPostById(postId);
        row.status = status;
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        return row;
    }
}
