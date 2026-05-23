import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { Post } from './post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UserService } from '../user/user.service';
import { emitToConversation } from '../../common/socket/chat-socket';
import { Friendship } from '../friendship/friendship.entity';
import { FriendshipStatus } from '../../common/enum/friendship-status.enum';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post, 'mongodb')
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(Friendship, 'mariadb')
    private readonly friendshipRepo: Repository<Friendship>,
    private readonly userService: UserService,
  ) {}

  private async getAcceptedFriendIds(userId: number): Promise<number[]> {
    const friendships = await this.friendshipRepo.find({
      where: [
        { userId1: userId, status: FriendshipStatus.ACCEPTED },
        { userId2: userId, status: FriendshipStatus.ACCEPTED },
      ],
    });

    return friendships.map((item) =>
      Number(item.userId1) === Number(userId) ? item.userId2 : item.userId1,
    );
  }

  private toResponse(post: Post, viewerId?: number) {
    const userInteracts = (post.interacts || []).map((i) => ({
      userId: i.userId,
      displayName: i.displayName,
      avatarUrl: i.avatarUrl,
      type: i.interactType,
      createdAt: i.createdAt,
    }));

    const viewerInteract = viewerId
      ? userInteracts.find((i) => i.userId === viewerId)
      : null;

    return {
      id: String(post._id),
      title: post.title || '',
      content: post.content,
      mediaUrl: post.mediaUrl,
      visibility: post.visibility || 'public',
      createdAt: post.createdAt?.toISOString?.() ?? new Date().toISOString(),
      authorId: post.owner?.userId,
      authorName: post.owner?.displayName || 'Người dùng',
      authorAvatar: post.owner?.avatarUrl,
      owner: post.owner,
      reactionCount: userInteracts.length,
      commentCount: post.commentCount || 0,
      interacts: userInteracts,
      viewerReaction: viewerInteract?.type || null,
    };
  }

  async create(createPostDto: CreatePostDto, ownerId: number) {
    const user = await this.userService.findOne(ownerId);
    if (!user) throw new NotFoundException('User not found');

    const content = String(createPostDto.content || '').trim();
    const mediaUrl = String(createPostDto.mediaUrl || '').trim();
    if (!content && !mediaUrl) {
      throw new BadRequestException('Bai viet can co noi dung hoac anh/video');
    }

    const post = this.postsRepository.create({
      title: String(createPostDto.title || '').trim(),
      content,
      visibility: createPostDto.visibility || 'public',
      mediaUrl,
      createdAt: new Date(),
      interacts: [],
      commentCount: 0,
      owner: {
        userId: user.userId,
        displayName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
    });

    const saved = await this.postsRepository.save(post);

    // Emit realtime event for feed update
    emitToConversation(
      'global-feed',
      'post:new',
      this.toResponse(saved, ownerId),
    );

    return this.toResponse(saved, ownerId);
  }

  async findAll(viewerId?: number, limit = 30) {
    if (!viewerId) {
      const posts = await this.postsRepository.find({
        where: { visibility: 'public' } as any,
        order: { createdAt: 'DESC' },
        take: limit,
      });
      return posts.map((p) => this.toResponse(p));
    }

    const friendIds = await this.getAcceptedFriendIds(viewerId);
    const allowedAuthorIds = new Set<number>([viewerId, ...friendIds]);

    const rawPosts = await this.postsRepository.find({
      order: { createdAt: 'DESC' },
      take: Math.max(limit * 5, 150),
    });

    const posts = rawPosts
      .filter((post) => {
        const authorId = Number(post.owner?.userId || 0);
        if (!authorId || !allowedAuthorIds.has(authorId)) {
          return false;
        }

        // Owner always sees their own posts (including private).
        if (authorId === viewerId) {
          return true;
        }

        return String(post.visibility || 'public') !== 'private';
      })
      .slice(0, Math.max(limit, 1));

    return posts.map((p) => this.toResponse(p, viewerId));
  }

  async findById(id: string, viewerId?: number) {
    const post = await this.postsRepository.findOne({
      where: { _id: this.toObjectId(id) } as any,
    });
    if (!post) throw new NotFoundException('Post not found');

    if (viewerId) {
      const authorId = Number(post.owner?.userId || 0);
      if (authorId !== viewerId) {
        const friendIds = await this.getAcceptedFriendIds(viewerId);
        const isFriend = friendIds.includes(authorId);
        const isPublic = String(post.visibility || 'public') !== 'private';
        if (!isFriend || !isPublic) {
          throw new ForbiddenException('Ban khong co quyen xem bai viet nay');
        }
      }
    }

    return this.toResponse(post, viewerId);
  }

  async findByUser(userId: number, viewerId?: number) {
    const requestedUserId = Number(userId);
    const currentUserId = Number(viewerId || 0);

    const allUserPosts = await this.postsRepository.find({
      where: { 'owner.userId': requestedUserId } as any,
      order: { createdAt: 'DESC' },
    });

    if (!currentUserId || currentUserId === requestedUserId) {
      return allUserPosts.map((p) => this.toResponse(p, viewerId));
    }

    const friendIds = await this.getAcceptedFriendIds(currentUserId);
    const isFriend = friendIds.includes(requestedUserId);
    if (!isFriend) {
      return [];
    }

    return allUserPosts
      .filter((post) => String(post.visibility || 'public') !== 'private')
      .map((p) => this.toResponse(p, viewerId));
  }

  async update(
    id: string,
    data: { content?: string; mediaUrl?: string; visibility?: string },
    userId: number,
  ) {
    const post = await this.postsRepository.findOne({
      where: { _id: this.toObjectId(id) } as any,
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.owner?.userId !== userId)
      throw new ForbiddenException('Not authorized');

    if (data.content !== undefined) post.content = data.content;
    if (data.mediaUrl !== undefined) post.mediaUrl = data.mediaUrl;
    if (data.visibility !== undefined) post.visibility = data.visibility as any;

    const saved = await this.postsRepository.save(post);
    return this.toResponse(saved, userId);
  }

  async delete(id: string, userId: number) {
    const post = await this.postsRepository.findOne({
      where: { _id: this.toObjectId(id) } as any,
    });
    if (!post) throw new NotFoundException('Post not found');
    if (post.owner?.userId !== userId)
      throw new ForbiddenException('Not authorized');

    await this.postsRepository.delete({ _id: this.toObjectId(id) } as any);
    return { message: 'Post deleted successfully' };
  }

  async react(id: string, userId: number, type: string) {
    const user = await this.userService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    const post = await this.postsRepository.findOne({
      where: { _id: this.toObjectId(id) } as any,
    });
    if (!post) throw new NotFoundException('Post not found');

    // Remove existing reaction
    post.interacts = (post.interacts || []).filter((i) => i.userId !== userId);

    // Add new reaction
    post.interacts.push({
      userId: user.userId,
      displayName: user.fullName,
      avatarUrl: user.avatarUrl,
      interactType: type as any,
      createdAt: new Date(),
    });

    const saved = await this.postsRepository.save(post);
    return this.toResponse(saved, userId);
  }

  async unreact(id: string, userId: number) {
    const user = await this.userService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    const post = await this.postsRepository.findOne({
      where: { _id: this.toObjectId(id) } as any,
    });
    if (!post) throw new NotFoundException('Post not found');

    post.interacts = (post.interacts || []).filter((i) => i.userId !== userId);
    const saved = await this.postsRepository.save(post);
    return this.toResponse(saved, userId);
  }

  async incrementCommentCount(id: string) {
    await this.postsRepository.update(
      { _id: this.toObjectId(id) } as any,
      { commentCount: () => 'commentCount + 1' } as any,
    );
  }

  private toObjectId(id: string): any {
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Post id khong hop le');
    }
    return new ObjectId(id);
  }
}
