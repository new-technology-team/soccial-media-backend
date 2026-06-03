import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post as NestPost,
  Patch,
  Delete,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';
import { promises as fs } from 'fs';
import { extname, join } from 'path';

@Controller('api/social')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @NestPost('posts')
  @UseGuards(JwtAuthGuard)
  create(@Body() createPostDto: CreatePostDto, @Req() req: any) {
    return this.postService.create(createPostDto, req.user.sub);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  async getFeed(@Req() req: any, @Query('limit') limit?: string) {
    const posts = await this.postService.findAll(
      req.user?.sub,
      limit ? parseInt(limit, 10) : 30,
    );
    return { posts };
  }

  @Get('users/:userId/posts')
  @UseGuards(JwtAuthGuard)
  async getUserPosts(@Param('userId') userId: string, @Req() req: any) {
    const posts = await this.postService.findByUser(
      parseInt(userId, 10),
      req.user.sub,
    );
    return { posts };
  }

  @Get('posts/:id')
  @UseGuards(JwtAuthGuard)
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
  react(
    @Param('id') id: string,
    @Body() body: { type?: string },
    @Req() req: any,
  ) {
    return this.postService.react(id, req.user.sub, body.type || 'like');
  }

  @Delete('posts/:id/reaction')
  @UseGuards(JwtAuthGuard)
  unreact(@Param('id') id: string, @Req() req: any) {
    return this.postService.unreact(id, req.user.sub);
  }

  @NestPost('posts/upload-base64')
  @UseGuards(JwtAuthGuard)
  async uploadPostMediaBase64(
    @Req() req: any,
    @Body()
    body: {
      fileName?: string;
      contentType?: string;
      base64Data?: string;
    },
  ) {
    const base64Raw = String(body?.base64Data || '').trim();
    if (!base64Raw) {
      throw new BadRequestException('Thieu base64Data');
    }

    const base64Payload = base64Raw.includes(',')
      ? base64Raw.split(',').pop() || ''
      : base64Raw;

    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer.length) {
      throw new BadRequestException('Du lieu media khong hop le');
    }
    if (buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('Kich thuoc file qua lon (toi da 10MB)');
    }

    const requestedExt = extname(String(body?.fileName || '')).toLowerCase();
    const fileExt =
      ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4'].includes(requestedExt)
        ? requestedExt
        : String(body?.contentType || '').toLowerCase().includes('mp4')
          ? '.mp4'
          : '.jpg';

    const userId = Number(req?.user?.sub || 0);
    if (!userId) {
      throw new BadRequestException('Khong xac dinh duoc user');
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${fileExt}`;
    const relativeDir = join('uploads', 'posts', String(userId));
    const absoluteDir = join(process.cwd(), relativeDir);
    await fs.mkdir(absoluteDir, { recursive: true });

    const absolutePath = join(absoluteDir, fileName);
    await fs.writeFile(absolutePath, buffer);

    const fileUrl = `/${relativeDir.replace(/\\/g, '/')}/${fileName}`;
    return { fileUrl };
  }
}
