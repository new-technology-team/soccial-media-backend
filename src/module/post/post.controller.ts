import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
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
    @Get('posts/saved')
    listSavedPosts(@CurrentUser() user: any) {
        return this.postService.listSavedPosts(user.id).then((posts) => ({ posts }));
    }

    @Get('posts/:postId')
    getFeedPost(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.getFeedPost(postId, user?.id);
    }

    @UseGuards(JwtAuthGuard)
    @Post('posts/:postId/save')
    savePost(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.savePost(user.id, postId).then(() => ({ saved: true }));
    }

    @UseGuards(JwtAuthGuard)
    @Delete('posts/:postId/save')
    unsavePost(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.unsavePost(user.id, postId).then(() => ({ saved: false }));
    }

    @UseGuards(JwtAuthGuard)
    @Post('posts/upload-base64')
    uploadPostBase64(@CurrentUser() user: any, @Body() body: any) {
        return this.postService.uploadPostBase64(user.id, body);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('posts/:postId')
    updateFeedPost(@CurrentUser() user: any, @Param('postId') postId: string, @Body() body: any) {
        return this.postService.updateFeedPost(user.id, postId, body);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('posts/:postId')
    deleteFeedPost(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.deleteFeedPost(user.id, postId);
    }

    @UseGuards(JwtAuthGuard)
    @Get('admin/posts')
    listAdminPosts(@CurrentUser() user: any, @Query('q') q?: string, @Query('status') status?: string, @Query('visibility') visibility?: string, @Query('limit') limit?: string) {
        return this.postService.listAdminPosts(user, { q, status, visibility, limit: Number(limit || 200) });
    }

    @UseGuards(JwtAuthGuard)
    @Patch('admin/posts/:postId')
    updateAdminPost(@CurrentUser() user: any, @Param('postId') postId: string, @Body() body: any) {
        return this.postService.updateAdminPost(user, postId, body);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('admin/posts/:postId')
    deleteAdminPost(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.deleteAdminPost(user, postId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('posts/:postId/reaction')
    reactPost(@CurrentUser() user: any, @Param('postId') postId: string, @Body() body: { type: string }) {
        return this.postService.reactPost(user.id, postId, body?.type || 'like');
    }

    @Get('posts/:postId/reactions')
    listReactions(@Param('postId') postId: string) {
        return this.postService.listPostReactions(postId);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('posts/:postId/reaction')
    removeReaction(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.removeReaction(user.id, postId);
    }
}
