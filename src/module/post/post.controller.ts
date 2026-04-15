import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CreatePostDto } from "./dto/create-post.dto";
import { PostService } from "./post.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";

@Controller('social')
export class PostController {
    constructor(private readonly postService: PostService) { }
    @UseGuards(JwtAuthGuard)
    @Post('post')
    createPost(@Body() createPostDto: CreatePostDto) {
        return this.postService.createPost(createPostDto);
    }

    @Get('feed')
    listFeed(@CurrentUser() user: any, @Query('includeHidden') includeHidden?: string, @Query('limit') limit?: string) {
        return this.postService.listFeed(user?.id, String(includeHidden || '') === '1', Number(limit || 40));
    }

    @UseGuards(JwtAuthGuard)
    @Post('posts')
    createFeedPost(@CurrentUser() user: any, @Body() body: any) {
        return this.postService.createFeedPost(user.id, body);
    }

    @UseGuards(JwtAuthGuard)
    @Post('posts/:postId/reaction')
    reactPost(@CurrentUser() user: any, @Param('postId') postId: string, @Body() body: { type: string }) {
        return this.postService.reactPost(user.id, postId, body?.type || 'like');
    }

    @UseGuards(JwtAuthGuard)
    @Delete('posts/:postId/reaction')
    removeReaction(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.removeReaction(user.id, postId);
    }
}