import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectId } from 'mongodb';
import { Repository } from 'typeorm';
import { Comment } from './comment.entity';
import { UserService } from '../user/user.service';
import { PostService } from '../post/post.service';
import { emitToConversation } from '../../common/socket/chat-socket';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment, 'mongodb')
    private readonly commentsRepository: Repository<Comment>,
    private readonly userService: UserService,
    private readonly postService: PostService,
    private readonly notificationService: NotificationService,
  ) {}

  private toResponse(comment: Comment, viewerId?: number) {
    const viewerReact = viewerId
      ? (comment.reacts || []).find((r) => r.userId === viewerId)
      : null;

    return {
      id: String(comment._id),
      postId: comment.postId,
      parentId: comment.parentId || null,
      content: comment.content,
      fileUrl: comment.fileUrl,
      createdAt: comment.createdAt?.toISOString?.() ?? new Date().toISOString(),
      userId: comment.owner?.userId,
      authorName: comment.owner?.displayName || 'Nguoi dung',
      authorAvatar: comment.owner?.avatarUrl,
      owner: comment.owner,
      reactionCount: (comment.reacts || []).length,
      viewerReaction: viewerReact?.type || null,
      replyCount: 0,
    };
  }

  async create(
    postId: string,
    content: string,
    parentId: string | null,
    userId: number,
  ) {
    const user = await this.userService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    const comment = this.commentsRepository.create({
      postId,
      content,
      parentId: parentId || '',
      fileUrl: '',
      createdAt: new Date(),
      owner: {
        userId: user.userId,
        displayName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      reacts: [],
    });

    const saved = await this.commentsRepository.save(comment);

    // Increment post comment count
    try {
      await this.postService.incrementCommentCount(postId);
    } catch {
      /* ignore */
    }

    // Emit realtime event
    emitToConversation(
      `post-${postId}`,
      'comment:new',
      this.toResponse(saved, userId),
    );
    emitToConversation(
      'global-feed',
      'comment:new',
      this.toResponse(saved, userId),
    );

    try {
      const postSummary = await this.postService.getPostSummary(postId);
      const postOwnerId = Number(postSummary?.authorId || 0);
      if (postOwnerId > 0 && postOwnerId !== Number(userId)) {
        await this.notificationService.create({
          userId: postOwnerId,
          type: 'post_comment',
          title: 'Co binh luan moi',
          content: `${user.fullName} vua binh luan bai viet cua ban`,
          link: '/feed',
          meta: {
            postId,
            commentId: String(saved._id),
            actorId: Number(user.userId),
            actorName: user.fullName,
            parentId: parentId || null,
          },
        });
      }

      if (parentId) {
        const parentComment = await this.commentsRepository.findOne({
          where: { _id: this.toObjectId(parentId) } as any,
        });
        const parentOwnerId = Number(parentComment?.owner?.userId || 0);
        if (
          parentOwnerId > 0 &&
          parentOwnerId !== Number(userId) &&
          parentOwnerId !== postOwnerId
        ) {
          await this.notificationService.create({
            userId: parentOwnerId,
            type: 'comment_reply',
            title: 'Co phan hoi binh luan moi',
            content: `${user.fullName} da tra loi binh luan cua ban`,
            link: '/feed',
            meta: {
              postId,
              commentId: String(saved._id),
              parentId,
              actorId: Number(user.userId),
              actorName: user.fullName,
            },
          });
        }
      }
    } catch {
      /* ignore notification errors */
    }

    return { comment: this.toResponse(saved, userId) };
  }

  async findByPost(postId: string, viewerId?: number) {
    const comments = await this.commentsRepository.find({
      where: { postId, parentId: { $in: ['', null] } as any },
      order: { createdAt: 'ASC' },
    });

    const replies = await this.commentsRepository.find({
      where: { postId, parentId: { $ne: '' } as any },
      order: { createdAt: 'ASC' },
    });

    const commentMap = new Map<string, any[]>();
    for (const reply of replies) {
      const parentKey = reply.parentId || String(reply._id);
      if (!commentMap.has(parentKey)) commentMap.set(parentKey, []);
      commentMap.get(parentKey)!.push(this.toResponse(reply, viewerId));
    }

    return {
      comments: comments.map((c) => ({
        ...this.toResponse(c, viewerId),
        replyCount: commentMap.get(String(c._id))?.length || 0,
        replies: commentMap.get(String(c._id)) || [],
      })),
      total: comments.length,
    };
  }

  async react(commentId: string, userId: number, type: string) {
    const user = await this.userService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    const comment = await this.commentsRepository.findOne({
      where: { _id: this.toObjectId(commentId) } as any,
    });
    if (!comment) throw new NotFoundException('Comment not found');

    comment.reacts = (comment.reacts || []).filter((r) => r.userId !== userId);
    comment.reacts.push({
      userId: user.userId,
      displayName: user.fullName,
      avatarUrl: user.avatarUrl,
      type,
      createdAt: new Date(),
    });

    const saved = await this.commentsRepository.save(comment);

    const ownerId = Number(saved.owner?.userId || 0);
    if (ownerId > 0 && ownerId !== Number(userId)) {
      try {
        await this.notificationService.create({
          userId: ownerId,
          type: 'comment_reaction',
          title: 'Co nguoi tha cam xuc binh luan',
          content: `${user.fullName} da tha cam xuc binh luan cua ban`,
          link: '/feed',
          meta: {
            postId: saved.postId,
            commentId: String(saved._id),
            actorId: Number(user.userId),
            actorName: user.fullName,
            reactionType: type,
          },
        });
      } catch {
        /* ignore notification errors */
      }
    }

    return { comment: this.toResponse(saved, userId) };
  }

  async unreact(commentId: string, userId: number) {
    const comment = await this.commentsRepository.findOne({
      where: { _id: this.toObjectId(commentId) } as any,
    });
    if (!comment) throw new NotFoundException('Comment not found');

    comment.reacts = (comment.reacts || []).filter((r) => r.userId !== userId);
    const saved = await this.commentsRepository.save(comment);
    return { comment: this.toResponse(saved, userId) };
  }

  async delete(commentId: string, userId: number) {
    const comment = await this.commentsRepository.findOne({
      where: { _id: this.toObjectId(commentId) } as any,
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.owner?.userId !== userId)
      throw new ForbiddenException('Not authorized');

    await this.commentsRepository.delete({
      _id: this.toObjectId(commentId),
    } as any);

    try {
      await this.postService.decrementCommentCount(comment.postId);
    } catch {
      /* ignore */
    }

    return { message: 'Comment deleted successfully' };
  }

  async syncAuthorProfile(userId: number, fullName: string, avatarUrl: string) {
    const comments = await this.commentsRepository.find({});
    if (!comments.length) return;

    for (const comment of comments) {
      if (Number(comment.owner?.userId) === Number(userId)) {
        comment.owner.displayName = fullName;
        comment.owner.avatarUrl = avatarUrl || '';
      }

      comment.reacts = (comment.reacts || []).map((react: any) => {
        if (Number(react?.userId) !== Number(userId)) return react;
        return {
          ...react,
          displayName: fullName,
          avatarUrl: avatarUrl || '',
        };
      });
    }

    await this.commentsRepository.save(comments);
  }

  private toObjectId(id: string): any {
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Comment id khong hop le');
    }
    return new ObjectId(id);
  }
}
