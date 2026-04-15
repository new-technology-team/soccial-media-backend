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
exports.CommentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const comment_entity_1 = require("./comment.entity");
const user_service_1 = require("../user/user.service");
const post_service_1 = require("../post/post.service");
let CommentService = class CommentService {
    commentRepository;
    userService;
    postService;
    constructor(commentRepository, userService, postService) {
        this.commentRepository = commentRepository;
        this.userService = userService;
        this.postService = postService;
    }
    async listPostComments(postId, viewerUserId) {
        const rows = await this.commentRepository.find({
            where: { postId },
            order: { createdAt: 'ASC' },
        });
        const comments = [];
        for (const row of rows) {
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
                viewerReaction: (row.reactions || []).find((r) => Number(r.userId) === Number(viewerUserId))?.type || null,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            });
        }
        return { comments };
    }
    async createComment(actorId, postId, content) {
        await this.postService.getPostById(postId);
        const now = new Date();
        const row = await this.commentRepository.save(this.commentRepository.create({
            postId,
            userId: actorId,
            content: String(content || '').trim(),
            file: null,
            status: 'visible',
            reactions: [],
            createdAt: now,
            updatedAt: now,
        }));
        await this.postService.increaseCommentCount(postId);
        const { comments } = await this.listPostComments(postId, actorId);
        return { comment: comments.find((item) => item.id === String(row._id)) };
    }
    async reactComment(actorId, commentId, type) {
        const row = await this.commentRepository.findOne({ where: { _id: new typeorm_2.ObjectId(commentId) } });
        if (!row || row.status !== 'visible') {
            throw new common_1.NotFoundException('Không tìm thấy bình luận');
        }
        row.reactions = (row.reactions || []).filter((item) => Number(item.userId) !== Number(actorId));
        row.reactions.push({ userId: actorId, type: type || 'like', createdAt: new Date() });
        row.updatedAt = new Date();
        await this.commentRepository.save(row);
        const { comments } = await this.listPostComments(row.postId, actorId);
        return { message: 'Đã cập nhật tương tác bình luận', comment: comments.find((item) => item.id === commentId) };
    }
    async removeCommentReaction(actorId, commentId) {
        const row = await this.commentRepository.findOne({ where: { _id: new typeorm_2.ObjectId(commentId) } });
        if (!row || row.status !== 'visible') {
            throw new common_1.NotFoundException('Không tìm thấy bình luận');
        }
        row.reactions = (row.reactions || []).filter((item) => Number(item.userId) !== Number(actorId));
        row.updatedAt = new Date();
        await this.commentRepository.save(row);
        const { comments } = await this.listPostComments(row.postId, actorId);
        return { message: 'Đã gỡ tương tác bình luận', comment: comments.find((item) => item.id === commentId) };
    }
};
exports.CommentService = CommentService;
exports.CommentService = CommentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(comment_entity_1.Comment, 'mongodb')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        user_service_1.UserService,
        post_service_1.PostService])
], CommentService);
//# sourceMappingURL=comment.service.js.map