import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';

@Controller('api/social/discover')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  /**
   * Intelligent feed: mixes friend posts with recommended content.
   * New users with no friends get trending/recommended content.
   */
  @Get('feed')
  @UseGuards(JwtAuthGuard)
  async getDiscoverFeed(@Req() req: any, @Query('limit') limit?: string) {
    return this.discoveryService.getDiscoverFeed(
      req.user.sub,
      limit ? parseInt(limit, 10) : 30,
    );
  }

  /**
   * Suggested users to follow/add as friends.
   */
  @Get('suggested-users')
  @UseGuards(JwtAuthGuard)
  async getSuggestedUsers(@Req() req: any, @Query('limit') limit?: string) {
    const users = await this.discoveryService.getSuggestedUsers(
      req.user.sub,
      limit ? parseInt(limit, 10) : 8,
    );
    return { users };
  }

  /**
   * Trending posts (most engaged in the last 7 days).
   */
  @Get('trending-posts')
  async getTrendingPosts(
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    const posts = await this.discoveryService.getTrendingPosts(
      req.user?.sub,
      limit ? parseInt(limit, 10) : 10,
    );
    return { posts };
  }

  /**
   * Trending hashtags.
   */
  @Get('trending-hashtags')
  async getTrendingHashtags(@Query('limit') limit?: string) {
    const hashtags = await this.discoveryService.getTrendingHashtags(
      limit ? parseInt(limit, 10) : 10,
    );
    return { hashtags };
  }
}
