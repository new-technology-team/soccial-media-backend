import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../post/post.entity';
import { User } from '../user/user.entity';
import { Friendship } from '../friendship/friendship.entity';
import { FriendshipStatus } from '../../common/enum/friendship-status.enum';
import { UserService } from '../user/user.service';
import { UserStatus } from '../../common/enum/user-status.enum';

@Injectable()
export class DiscoveryService {
  constructor(
    @InjectRepository(Post, 'mongodb')
    private readonly postsRepo: Repository<Post>,
    @InjectRepository(Friendship, 'mariadb')
    private readonly friendshipRepo: Repository<Friendship>,
    @InjectRepository(User, 'mariadb')
    private readonly userRepo: Repository<User>,
    private readonly userService: UserService,
  ) {}

  /**
   * Get recommended feed for a user.
   * If user has friends and enough posts -> return regular feed.
   * If not enough content -> supplement with recommended posts.
   */
  async getDiscoverFeed(
    viewerId: number,
    limit = 30,
  ): Promise<{
    posts: any[];
    friendPosts: any[];
    recommendedPosts: any[];
    totalFriends: number;
  }> {
    const friendIds = await this.getAcceptedFriendIds(viewerId);
    const totalFriends = friendIds.length;

    // Get friend posts (same as regular feed)
    const allowedAuthorIds = new Set<number>([viewerId, ...friendIds]);
    const rawPosts = await this.postsRepo.find({
      order: { createdAt: 'DESC' },
      take: 200,
    });

    const friendPosts = rawPosts
      .filter((post) => {
        const authorId = Number(post.owner?.userId || 0);
        if (!authorId) return false;
        if (!allowedAuthorIds.has(authorId)) return false;
        if (authorId === viewerId) return true;
        return String(post.visibility || 'public') !== 'private';
      })
      .slice(0, limit);

    // If we have enough friend posts, return them with some recommendations
    let recommendedPosts: any[] = [];
    const remaining = Math.max(limit - friendPosts.length, 0);

    if (remaining > 0 || totalFriends === 0) {
      recommendedPosts = await this.getRecommendedPosts(viewerId, friendIds, Math.max(remaining, limit));
    }

    const allPosts = this.interleavePosts(
      friendPosts.map((p) => this.toResponse(p, viewerId)),
      recommendedPosts,
      totalFriends === 0 ? 3 : 5, // Insert recommendation every N posts
    );

    return {
      posts: allPosts,
      friendPosts: friendPosts.map((p) => this.toResponse(p, viewerId)),
      recommendedPosts,
      totalFriends,
    };
  }

  /**
   * Get recommended public posts from users the viewer is not friends with.
   * Prioritized: most reactions -> most recent.
   */
  private async getRecommendedPosts(
    viewerId: number,
    friendIds: number[],
    limit: number,
  ): Promise<any[]> {
    const excludeIds = new Set<number>([viewerId, ...friendIds]);

    const publicPosts = await this.postsRepo.find({
      where: { visibility: 'public' } as any,
      order: { createdAt: 'DESC' },
      take: 100,
    });

    // Filter out own and friends' posts, sort by engagement (reactions + comments)
    const filtered = publicPosts
      .filter((post) => {
        const authorId = Number(post.owner?.userId || 0);
        return authorId > 0 && !excludeIds.has(authorId);
      })
      .sort((a, b) => {
        const scoreA = (a.interacts?.length || 0) + (a.commentCount || 0);
        const scoreB = (b.interacts?.length || 0) + (b.commentCount || 0);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    return filtered.map((p) => ({
      ...this.toResponse(p, viewerId),
      _recommended: true,
    }));
  }

  /**
   * Get trending/popular public posts (most engagement in the last 7 days).
   */
  async getTrendingPosts(viewerId?: number, limit = 10) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentPosts = await this.postsRepo.find({
      where: {
        visibility: 'public' as any,
      } as any,
      take: 200,
    });

    const filtered = recentPosts
      .filter((post) => post.createdAt >= sevenDaysAgo)
      .sort((a, b) => {
        const scoreA = (a.interacts?.length || 0) + (a.commentCount || 0);
        const scoreB = (b.interacts?.length || 0) + (b.commentCount || 0);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    return filtered.map((p) => this.toResponse(p, viewerId));
  }

  /**
   * Get trending hashtags from recent public posts.
   */
  async getTrendingHashtags(limit = 10): Promise<{ tag: string; count: number }[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentPosts = await this.postsRepo.find({
      where: {
        visibility: 'public' as any,
      } as any,
      take: 500,
    });

    const hashtagCounts = new Map<string, number>();

    for (const post of recentPosts) {
      if (post.createdAt < sevenDaysAgo) continue;
      const hashtags = this.extractHashtags(post.content || '');
      for (const tag of hashtags) {
        const lower = tag.toLowerCase();
        hashtagCounts.set(lower, (hashtagCounts.get(lower) || 0) + 1);
      }
    }

    return [...hashtagCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }

  /**
   * Get suggested users (people you may know).
   * Criteria: active, not friends, not blocked, have public content.
   */
  async getSuggestedUsers(
    viewerId: number,
    limit = 8,
  ): Promise<
    Array<{
      id: number;
      fullName: string;
      username: string;
      avatarUrl: string | null;
      bio: string | null;
      location: string | null;
      mutualFriends: number;
      postCount: number;
    }>
  > {
    const friendIds = await this.getAcceptedFriendIds(viewerId);
    const excludeIds = new Set<number>([viewerId, ...friendIds]);

    // Find users who are not friends and are active
    const allUsers = await this.userRepo.find({
      where: { status: UserStatus.ACTIVE } as any,
    });

    const suggested = allUsers.filter((u) => !excludeIds.has(u.userId));

    // Count posts per user (from MongoDB)
    const userPostCounts = new Map<number, number>();
    const allPublicPosts = await this.postsRepo.find({
      where: { visibility: 'public' } as any,
      take: 500,
    });
    for (const post of allPublicPosts) {
      const uid = Number(post.owner?.userId || 0);
      if (uid > 0) {
        userPostCounts.set(uid, (userPostCounts.get(uid) || 0) + 1);
      }
    }

    // Calculate mutual friends
    const getMutualCount = (userId: number): number => {
      let count = 0;
      for (const fid of friendIds) {
        // Check if userId and fid are friends
        const friendship = allPublicPosts.some(() => false); // Simplified - we skip full mutual calc
      }
      // More efficient: check friendship table
      // For now, estimate based on common friend network
      return 0;
    };

    // Sort by most posts (most active) first
    const sorted = suggested
      .map((u) => ({
        id: u.userId,
        fullName: u.fullName,
        username: u.username,
        avatarUrl: u.avatarUrl,
        bio: u.bio || null,
        location: u.location || null,
        mutualFriends: 0,
        postCount: userPostCounts.get(u.userId) || 0,
      }))
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, limit);

    // Calculate actual mutual friends (check if friend's friends are also friends with suggested user)
    for (const user of sorted) {
      let mutual = 0;
      for (const fid of friendIds) {
        const f = await this.friendshipRepo.findOne({
          where: [
            { userId1: fid, userId2: user.id, status: FriendshipStatus.ACCEPTED },
            { userId1: user.id, userId2: fid, status: FriendshipStatus.ACCEPTED },
          ],
        });
        if (f) mutual++;
      }
      user.mutualFriends = mutual;
    }

    return sorted;
  }

  /**
   * Get the friend IDs of a user.
   */
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

  /**
   * Interleave recommended posts into the main feed.
   * Inserts a recommended post every `gap` friend posts.
   */
  private interleavePosts(
    friendPosts: any[],
    recommendedPosts: any[],
    gap: number,
  ): any[] {
    if (recommendedPosts.length === 0) return friendPosts;
    if (friendPosts.length === 0) return recommendedPosts;

    const result: any[] = [];
    let friendIdx = 0;
    let recIdx = 0;

    while (friendIdx < friendPosts.length || recIdx < recommendedPosts.length) {
      // Add a batch of friend posts
      for (let i = 0; i < gap && friendIdx < friendPosts.length; i++) {
        result.push(friendPosts[friendIdx++]);
      }
      // Add one recommended post
      if (recIdx < recommendedPosts.length) {
        result.push(recommendedPosts[recIdx++]);
      }
    }

    return result;
  }

  /**
   * Extract hashtags from content string.
   */
  private extractHashtags(content: string): string[] {
    const matches = content.match(/#[^\s#.,!?;:]+/g);
    if (!matches) return [];
    return matches.map((tag) => tag.slice(1)); // Remove the # prefix
  }

  /**
   * Format post for API response.
   */
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
      authorUsername: post.owner?.username || '',
      authorAvatar: post.owner?.avatarUrl,
      reactionCount: userInteracts.length,
      commentCount: post.commentCount || 0,
      viewerReaction: viewerInteract?.type || null,
    };
  }
}
