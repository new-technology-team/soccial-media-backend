"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostService = void 0;
const common_1 = require("@nestjs/common");
const client_s3_1 = require("@aws-sdk/client-s3");
const mongodb_1 = require("mongodb");
const typeorm_1 = require("typeorm");
const typeorm_2 = require("@nestjs/typeorm");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const post_entity_1 = require("./post.entity");
const user_entity_1 = require("../user/user.entity");
const comment_entity_1 = require("../comment/comment.entity");
let PostService = class PostService {
    constructor(postsRepository, commentsRepository, usersRepository) {
        this.postsRepository = postsRepository;
        this.commentsRepository = commentsRepository;
        this.usersRepository = usersRepository;
    }
    getS3Config() {
        const bucket = process.env.AWS_S3_BUCKET || process.env.AWS_BUCKET_NAME || process.env.S3_BUCKET || '';
        const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-1';
        return { bucket, region };
    }
    getS3Client() {
        const { region } = this.getS3Config();
        return new client_s3_1.S3Client({
            region,
            credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
                ? {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                }
                : undefined,
        });
    }
    safeFileName(name) {
        const ext = path.extname(name || '').slice(0, 24);
        const base = path.basename(name || 'upload', ext).replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 64) || 'upload';
        return `${Date.now()}-${base}${ext}`;
    }
    extractS3Key(fileUrl) {
        if (!fileUrl)
            return null;
        const { bucket } = this.getS3Config();
        if (!bucket)
            return null;
        try {
            const url = new URL(fileUrl);
            if (url.hostname === `${bucket}.s3.amazonaws.com` || url.hostname.startsWith(`${bucket}.s3.`)) {
                return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
            }
            const pathParts = url.pathname.replace(/^\/+/, '').split('/');
            if (pathParts[0] === bucket) {
                return decodeURIComponent(pathParts.slice(1).join('/'));
            }
        }
        catch {
            return null;
        }
        return null;
    }
    async deleteMediaUrl(fileUrl) {
        if (!fileUrl)
            return;
        const key = this.extractS3Key(fileUrl);
        const { bucket } = this.getS3Config();
        if (key && bucket) {
            await this.getS3Client().send(new client_s3_1.DeleteObjectCommand({ Bucket: bucket, Key: key }));
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
    async toFeedPost(row, viewerUserId) {
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
            viewerReaction: (row.reactions || []).find((r) => Number(r.userId) === Number(viewerUserId))?.type || null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
    async createPost(createPostDto) {
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
    async listFeed(viewerUserId, includeHidden = false, limit = 40) {
        const rows = await this.postsRepository.find({
            order: { createdAt: 'DESC' },
            take: Math.min(Math.max(Number(limit || 40), 1), 100),
        });
        const posts = [];
        for (const row of rows) {
            if (!includeHidden && row.status !== 'published')
                continue;
            posts.push(await this.toFeedPost(row, viewerUserId));
        }
        return { posts };
    }
    async createFeedPost(actorId, body) {
        if (!body?.content && !body?.mediaUrl) {
            throw new common_1.BadRequestException('Bai viet can co noi dung hoac media');
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
    async getPostById(postId) {
        const row = await this.postsRepository.findOne({ where: { _id: new mongodb_1.ObjectId(postId) } });
        if (!row) {
            throw new common_1.NotFoundException('Khong tim thay bai viet');
        }
        return row;
    }
    async getFeedPost(postId, viewerUserId) {
        const row = await this.getPostById(postId);
        return { post: await this.toFeedPost(row, viewerUserId) };
    }
    async uploadPostBase64(actorId, body) {
        if (!body?.base64Data) {
            throw new common_1.BadRequestException('Thieu du lieu anh hoac video');
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
            await this.getS3Client().send(new client_s3_1.PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            }));
            return {
                message: 'Da tai media bai viet len S3',
                mediaUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
            };
        }
        const outputDir = path.join(process.cwd(), 'uploads', 'posts', String(actorId));
        await fs.promises.mkdir(outputDir, { recursive: true });
        await fs.promises.writeFile(path.join(outputDir, outputName), buffer);
        return {
            message: 'Da tai media bai viet',
            mediaUrl: `/uploads/posts/${actorId}/${outputName}`,
        };
    }
    async increaseCommentCount(postId) {
        const row = await this.getPostById(postId);
        row.commentCount = Number(row.commentCount || 0) + 1;
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
    }
    async updateFeedPost(actorId, postId, body) {
        const row = await this.getPostById(postId);
        if (Number(row.authorId) !== Number(actorId)) {
            throw new common_1.ForbiddenException('Ban khong co quyen sua bai viet nay');
        }
        const nextContent = body?.content !== undefined ? String(body.content || '') : row.content || '';
        const nextMedia = body?.mediaUrl !== undefined ? (body.mediaUrl || null) : row.mediaUrl || null;
        if (!nextContent.trim() && !nextMedia) {
            throw new common_1.BadRequestException('Bai viet can co noi dung hoac media');
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
    async deleteFeedPost(actorId, postId) {
        const row = await this.getPostById(postId);
        if (Number(row.authorId) !== Number(actorId)) {
            throw new common_1.ForbiddenException('Ban khong co quyen xoa bai viet nay');
        }
        await this.deleteMediaUrl(row.mediaUrl);
        await this.commentsRepository.delete({ postId });
        await this.postsRepository.delete({ _id: new mongodb_1.ObjectId(postId) });
        return { message: 'Da xoa bai viet va media lien quan' };
    }
    async reactPost(actorId, postId, type) {
        const row = await this.getPostById(postId);
        row.reactions = (row.reactions || []).filter((item) => Number(item.userId) !== Number(actorId));
        row.reactions.push({ userId: actorId, type: type || 'like', createdAt: new Date() });
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        return { message: 'Da cap nhat tuong tac', post: await this.toFeedPost(row, actorId) };
    }
    async removeReaction(actorId, postId) {
        const row = await this.getPostById(postId);
        row.reactions = (row.reactions || []).filter((item) => Number(item.userId) !== Number(actorId));
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        return { message: 'Da go tuong tac', post: await this.toFeedPost(row, actorId) };
    }
    async moderatePost(postId, status) {
        const row = await this.getPostById(postId);
        row.status = status;
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        return row;
    }
};
exports.PostService = PostService;
exports.PostService = PostService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_2.InjectRepository)(post_entity_1.Post, 'mongodb')),
    __param(1, (0, typeorm_2.InjectRepository)(comment_entity_1.Comment, 'mongodb')),
    __param(2, (0, typeorm_2.InjectRepository)(user_entity_1.User, 'mariadb')),
    __metadata("design:paramtypes", [typeorm_1.Repository,
        typeorm_1.Repository,
        typeorm_1.Repository])
], PostService);
//# sourceMappingURL=post.service.js.map