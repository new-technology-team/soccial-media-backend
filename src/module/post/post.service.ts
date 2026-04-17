import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CreatePostDto } from "./dto/create-post.dto";
import { Post } from "./post.entity";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "../user/user.entity";


@Injectable()
export class PostService {
    constructor(
        @InjectRepository(Post, 'mongodb')
        private readonly postsRepository: Repository<Post>,
        @InjectRepository(User, 'mariadb')
        private readonly usersRepository: Repository<User>,
    ) { }

    async createPost(createPostDto: CreatePostDto): Promise<Post> {
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

    async listFeed(viewerUserId?: number, includeHidden = false, limit = 40) {
        const rows = await this.postsRepository.find({
            order: { createdAt: 'DESC' },
            take: Math.min(Math.max(Number(limit || 40), 1), 100),
        });

        const posts: any[] = [];
        for (const row of rows as any[]) {
            if (!includeHidden && row.status !== 'published') continue;
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
                viewerReaction: (row.reactions || []).find((r: any) => Number(r.userId) === Number(viewerUserId))?.type || null,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            });
        }

        return { posts };
    }

    async createFeedPost(actorId: number, body: any) {
        if (!body?.content && !body?.mediaUrl) {
            throw new BadRequestException('Bài viết cần có nội dung hoặc mediaUrl');
        }

        const row = await this.postsRepository.save(
            this.postsRepository.create({
                content: body?.content || '',
                mediaUrl: body?.mediaUrl || null,
                visibility: body?.visibility || 'public',
                status: 'published',
                authorId: actorId,
                createdAt: new Date(),
                updatedAt: new Date(),
                reactions: [],
                commentCount: 0,
            }),
        );

        const [payload] = (await this.listFeed(actorId, true, 200)).posts.filter((item: any) => item.id === String((row as any)._id));
        return { post: payload };
    }

    async getPostById(postId: string) {
        const row = await this.postsRepository.findOne({ where: { _id: new ObjectId(postId) as any } as any });
        if (!row) {
            throw new NotFoundException('Không tìm thấy bài viết');
        }
        return row as any;
    }

    async increaseCommentCount(postId: string) {
        const row = await this.getPostById(postId);
        row.commentCount = Number(row.commentCount || 0) + 1;
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
    }

    async reactPost(actorId: number, postId: string, type: string) {
        const row = await this.getPostById(postId);
        row.reactions = (row.reactions || []).filter((item: any) => Number(item.userId) !== Number(actorId));
        row.reactions.push({ userId: actorId, type: type || 'like', createdAt: new Date() });
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        const [post] = (await this.listFeed(actorId, true, 200)).posts.filter((item: any) => item.id === String(row._id));
        return { message: 'Đã cập nhật tương tác', post };
    }

    async removeReaction(actorId: number, postId: string) {
        const row = await this.getPostById(postId);
        row.reactions = (row.reactions || []).filter((item: any) => Number(item.userId) !== Number(actorId));
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        const [post] = (await this.listFeed(actorId, true, 200)).posts.filter((item: any) => item.id === String(row._id));
        return { message: 'Đã gỡ tương tác', post };
    }

    async moderatePost(postId: string, status: string) {
        const row = await this.getPostById(postId);
        row.status = status;
        row.updatedAt = new Date();
        await this.postsRepository.save(row);
        return row;
    }
}