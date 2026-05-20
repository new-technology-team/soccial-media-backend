import { Body, Controller, Get, Post as NestPost, Patch, Delete, Param, UseGuards, Req, Query } from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';

@Controller('api/social')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @NestPost('posts')
  @UseGuards(JwtAuthGuard)
  create(@Body() createPostDto: CreatePostDto, @Req() req: any) {
    return this.postService.create(createPostDto, req.user.sub);
  }

  @Get('feed')
  async getFeed(@Req() req: any, @Query('limit') limit?: string) {
    const posts = await this.postService.findAll(
      req.user?.sub,
      limit ? parseInt(limit, 10) : 30,
    );
    return { posts };
  }

  @Get('posts/:id')
  async getPost(@Param('id') id: string, @Req() req: any) {
    const post = await this.postService.findById(id, req.user?.sub);
    return { post };
  }

  @Patch('posts/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.postService.update(id, body, req.user.sub);
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string, @Req() req: any) {
    return this.postService.delete(id, req.user.sub);
  }

  @NestPost('posts/:id/reaction')
  @UseGuards(JwtAuthGuard)
  react(@Param('id') id: string, @Body() body: { type?: string }, @Req() req: any) {
    return this.postService.react(id, req.user.sub, body.type || 'like');
  }

  @Delete('posts/:id/reaction')
  @UseGuards(JwtAuthGuard)
  unreact(@Param('id') id: string, @Req() req: any) {
    return this.postService.unreact(id, req.user.sub);
  }
}
