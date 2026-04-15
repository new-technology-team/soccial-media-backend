"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostService = void 0;
const common_1 = require("@nestjs/common");
const post_entity_1 = require("./post.entity");
const typeorm_1 = require("typeorm");
const typeorm_2 = require("@nestjs/typeorm");
const user_entity_1 = require("../user/user.entity");
let PostService = class PostService {
    postsRepository;
    usersRepository;
    constructor(postsRepository, usersRepository) {
        this.postsRepository = postsRepository;
        this.usersRepository = usersRepository;
    }
    async createPost(createPostDto) {
        const user = await this.usersRepository.findOne({ where: { userId: createPostDto.ownerId } });
        if (!user) {
            throw new Error("User not found");
        }
        const post = this.postsRepository.create({
            content: createPostDto.content,
            mediaUrl: null,
            visibility: 'public',
            status: 'published',
            authorId: user.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            reactions: [],
            commentCount: 0,
        });
        return this.postsRepository.save(post);
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
            const author = await this.usersRepository.findOne({ where: { userId: row.authorId } });
            posts.push({
                id: String(row._id),
                authorId: row.authorId,
                authorName: author?.displayName || 'Người dùng',
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
            });
        }
        return { posts };
    }
    async createFeedPost(actorId, body) {
        if (!body?.content && !body?.mediaUrl) {
            throw new common_1.BadRequestException('Bài viết cần có nội dung hoặc mediaUrl');
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
        const [payload] = (await this.listFeed(actorId, true, 200)).posts.filter((item) => item.id === String(row._id));
        return { post: payload };
    }
    async getPostById(postId) {
        const row = await this.postsRepository.findOne({ where: { _id: new typeorm_1.ObjectId(postId) } });
        if (!row) {
            throw new common_1.NotFoundException('Không tìm thấy bài viết');
        }
        return row;
    }
    async increaseCommentCount(postId) {
        const row = await this.getPostById(postId);
        row.commentCount = Number(row.commentCount || 0) + 1;
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
    }
    async reactPost(actorId, postId, type) {
        const row = await this.getPostById(postId);
        row.reactions = (row.reactions || []).filter((item) => Number(item.userId) !== Number(actorId));
        row.reactions.push({ userId: actorId, type: type || 'like', createdAt: new Date() });
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        const [post] = (await this.listFeed(actorId, true, 200)).posts.filter((item) => item.id === String(row._id));
        return { message: 'Đã cập nhật tương tác', post };
    }
    async removeReaction(actorId, postId) {
        const row = await this.getPostById(postId);
        row.reactions = (row.reactions || []).filter((item) => Number(item.userId) !== Number(actorId));
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        const [post] = (await this.listFeed(actorId, true, 200)).posts.filter((item) => item.id === String(row._id));
        return { message: 'Đã gỡ tương tác', post };
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
    __param(1, (0, typeorm_2.InjectRepository)(user_entity_1.User, 'mariadb')),
    __metadata("design:paramtypes", [typeorm_1.Repository,
        typeorm_1.Repository])
], PostService);
//# sourceMappingURL=post.service.js.map