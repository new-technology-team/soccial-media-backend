import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CreatePostDto } from "./dto/create-post.dto";
import { PostService } from "./post.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";

/**
 * PostController - Bộ điều khiển quản lý bài viết (Post)
 * 
 * Xử lý các request liên quan đến bài viết trong mạng xã hội:
 * - Tạo, cập nhật, xóa bài viết
 * - Lấy danh sách bài viết (feed)
 * - Lưu / bỏ lưu bài viết
 * - Reaction (like, ...) cho bài viết
 * - Quản lý bài viết dành cho admin
 * 
 * Base route: /social
 */
@Controller('social')
export class PostController {

    /**
     * Khởi tạo controller với PostService được inject vào
     * @param postService - Service xử lý logic nghiệp vụ của bài viết
     */
    constructor(private readonly postService: PostService) { }

    /**
     * [POST] /social/post
     * Tạo bài viết mới (API cũ)
     * 
     * Yêu cầu xác thực JWT.
     * 
     * @param createPostDto - Dữ liệu tạo bài viết (title, content, ...)
     * @returns Bài viết vừa được tạo
     */
    @UseGuards(JwtAuthGuard)
    @Post('post')
    createPost(@Body() createPostDto: CreatePostDto) {
        return this.postService.createPost(createPostDto);
    }

    /**
     * [GET] /social/feed
     * Lấy danh sách bài viết trên feed (không cần đăng nhập)
     * 
     * Nếu có token hợp lệ thì user sẽ được nhận diện để cá nhân hóa feed.
     * 
     * @param user - Thông tin người dùng hiện tại (nếu có)
     * @param includeHidden - Truyền '1' để bao gồm bài viết ẩn
     * @param limit - Số lượng bài viết tối đa trả về (mặc định 40)
     * @returns Danh sách bài viết trên feed
     */
    @Get('feed')
    listFeed(
        @CurrentUser() user: any,
        @Query('includeHidden') includeHidden?: string,
        @Query('limit') limit?: string
    ) {
        return this.postService.listFeed(
            user?.id,
            String(includeHidden || '') === '1', // Chuyển '1' thành true, còn lại là false
            Number(limit || 40)                  // Mặc định lấy 40 bài nếu không truyền limit
        );
    }

    /**
     * [POST] /social/posts
     * Tạo bài viết mới trên feed (API mới thay thế /social/post)
     * 
     * Yêu cầu xác thực JWT.
     * 
     * @param user - Thông tin người dùng đang đăng nhập
     * @param body - Nội dung bài viết (content, images, visibility, ...)
     * @returns Bài viết vừa được tạo
     */
    @UseGuards(JwtAuthGuard)
    @Post('posts')
    createFeedPost(@CurrentUser() user: any, @Body() body: any) {
        return this.postService.createFeedPost(user.id, body);
    }

    /**
     * [GET] /social/posts/saved
     * Lấy danh sách bài viết đã lưu của người dùng hiện tại
     * 
     * Yêu cầu xác thực JWT.
     * 
     * @param user - Thông tin người dùng đang đăng nhập
     * @returns Object chứa danh sách bài viết đã lưu: { posts: [...] }
     */
    @UseGuards(JwtAuthGuard)
    @Get('posts/saved')
    listSavedPosts(@CurrentUser() user: any) {
        // Wrap kết quả trong object { posts } để thống nhất format response
        return this.postService.listSavedPosts(user.id).then((posts) => ({ posts }));
    }

    /**
     * [GET] /social/posts/:postId
     * Lấy chi tiết một bài viết theo ID (không cần đăng nhập)
     * 
     * Nếu có token hợp lệ, user sẽ được nhận diện để kiểm tra
     * quyền xem bài viết (ví dụ: bài viết chỉ bạn bè mới xem được).
     * 
     * @param user - Thông tin người dùng hiện tại (nếu có)
     * @param postId - ID của bài viết cần lấy
     * @returns Chi tiết bài viết
     */
    @Get('posts/:postId')
    getFeedPost(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.getFeedPost(postId, user?.id);
    }

    /**
     * [POST] /social/posts/:postId/save
     * Lưu một bài viết vào danh sách đã lưu của người dùng
     * 
     * Yêu cầu xác thực JWT.
     * 
     * @param user - Thông tin người dùng đang đăng nhập
     * @param postId - ID của bài viết cần lưu
     * @returns { saved: true } nếu lưu thành công
     */
    @UseGuards(JwtAuthGuard)
    @Post('posts/:postId/save')
    savePost(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.savePost(user.id, postId).then(() => ({ saved: true }));
    }

    /**
     * [DELETE] /social/posts/:postId/save
     * Bỏ lưu một bài viết khỏi danh sách đã lưu của người dùng
     * 
     * Yêu cầu xác thực JWT.
     * 
     * @param user - Thông tin người dùng đang đăng nhập
     * @param postId - ID của bài viết cần bỏ lưu
     * @returns { saved: false } nếu bỏ lưu thành công
     */
    @UseGuards(JwtAuthGuard)
    @Delete('posts/:postId/save')
    unsavePost(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.unsavePost(user.id, postId).then(() => ({ saved: false }));
    }

    /**
     * [POST] /social/posts/upload-base64
     * Upload ảnh/file cho bài viết dưới dạng chuỗi Base64
     * 
     * Yêu cầu xác thực JWT.
     * Thường dùng khi client không thể gửi multipart/form-data
     * mà thay vào đó encode ảnh thành chuỗi Base64.
     * 
     * @param user - Thông tin người dùng đang đăng nhập
     * @param body - Object chứa chuỗi Base64 của ảnh/file cần upload
     * @returns URL hoặc thông tin file sau khi upload thành công
     */
    @UseGuards(JwtAuthGuard)
    @Post('posts/upload-base64')
    uploadPostBase64(@CurrentUser() user: any, @Body() body: any) {
        return this.postService.uploadPostBase64(user.id, body);
    }

    /**
     * [PATCH] /social/posts/:postId
     * Cập nhật nội dung bài viết
     * 
     * Yêu cầu xác thực JWT.
     * Chỉ chủ bài viết mới có quyền chỉnh sửa (kiểm tra trong service).
     * 
     * @param user - Thông tin người dùng đang đăng nhập
     * @param postId - ID của bài viết cần cập nhật
     * @param body - Dữ liệu cần cập nhật (content, visibility, ...)
     * @returns Bài viết sau khi đã được cập nhật
     */
    @UseGuards(JwtAuthGuard)
    @Patch('posts/:postId')
    updateFeedPost(
        @CurrentUser() user: any,
        @Param('postId') postId: string,
        @Body() body: any
    ) {
        return this.postService.updateFeedPost(user.id, postId, body);
    }

    /**
     * [DELETE] /social/posts/:postId
     * Xóa bài viết
     * 
     * Yêu cầu xác thực JWT.
     * Chỉ chủ bài viết mới có quyền xóa (kiểm tra trong service).
     * 
     * @param user - Thông tin người dùng đang đăng nhập
     * @param postId - ID của bài viết cần xóa
     * @returns Kết quả xóa bài viết
     */
    @UseGuards(JwtAuthGuard)
    @Delete('posts/:postId')
    deleteFeedPost(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.deleteFeedPost(user.id, postId);
    }

    /**
     * [GET] /social/admin/posts
     * Lấy danh sách tất cả bài viết dành cho admin
     * 
     * Yêu cầu xác thực JWT và quyền admin (kiểm tra trong service).
     * Hỗ trợ tìm kiếm và lọc theo nhiều tiêu chí.
     * 
     * @param user - Thông tin admin đang đăng nhập
     * @param q - Từ khóa tìm kiếm theo nội dung bài viết
     * @param status - Lọc theo trạng thái bài viết (active, hidden, ...)
     * @param visibility - Lọc theo phạm vi hiển thị (public, friends, private)
     * @param limit - Số lượng bài viết tối đa trả về (mặc định 200)
     * @returns Danh sách bài viết theo điều kiện lọc
     */
    @UseGuards(JwtAuthGuard)
    @Get('admin/posts')
    listAdminPosts(
        @CurrentUser() user: any,
        @Query('q') q?: string,
        @Query('status') status?: string,
        @Query('visibility') visibility?: string,
        @Query('limit') limit?: string
    ) {
        return this.postService.listAdminPosts(user, {
            q,
            status,
            visibility,
            limit: Number(limit || 200) // Mặc định lấy tối đa 200 bài cho admin
        });
    }

    /**
     * [PATCH] /social/admin/posts/:postId
     * Admin cập nhật bài viết của bất kỳ người dùng nào
     * 
     * Yêu cầu xác thực JWT và quyền admin (kiểm tra trong service).
     * Dùng để ẩn/hiện bài viết vi phạm, chỉnh sửa nội dung, ...
     * 
     * @param user - Thông tin admin đang đăng nhập
     * @param postId - ID của bài viết cần cập nhật
     * @param body - Dữ liệu cần cập nhật
     * @returns Bài viết sau khi đã được cập nhật bởi admin
     */
    @UseGuards(JwtAuthGuard)
    @Patch('admin/posts/:postId')
    updateAdminPost(
        @CurrentUser() user: any,
        @Param('postId') postId: string,
        @Body() body: any
    ) {
        return this.postService.updateAdminPost(user, postId, body);
    }

    /**
     * [DELETE] /social/admin/posts/:postId
     * Admin xóa bài viết của bất kỳ người dùng nào
     * 
     * Yêu cầu xác thực JWT và quyền admin (kiểm tra trong service).
     * Dùng để xóa bài viết vi phạm chính sách.
     * 
     * @param user - Thông tin admin đang đăng nhập
     * @param postId - ID của bài viết cần xóa
     * @returns Kết quả xóa bài viết
     */
    @UseGuards(JwtAuthGuard)
    @Delete('admin/posts/:postId')
    deleteAdminPost(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.deleteAdminPost(user, postId);
    }

    /**
     * [POST] /social/posts/:postId/reaction
     * Thêm reaction (like, love, haha, ...) vào bài viết
     * 
     * Yêu cầu xác thực JWT.
     * Nếu người dùng đã reaction trước đó, reaction cũ sẽ bị thay thế.
     * 
     * @param user - Thông tin người dùng đang đăng nhập
     * @param postId - ID của bài viết cần reaction
     * @param body - Object chứa loại reaction: { type: 'like' | 'love' | 'haha' | ... }
     *               Mặc định là 'like' nếu không truyền type
     * @returns Kết quả sau khi thêm reaction
     */
    @UseGuards(JwtAuthGuard)
    @Post('posts/:postId/reaction')
    reactPost(
        @CurrentUser() user: any,
        @Param('postId') postId: string,
        @Body() body: { type: string }
    ) {
        // Mặc định dùng 'like' nếu client không truyền type
        return this.postService.reactPost(user.id, postId, body?.type || 'like');
    }

    /**
     * [GET] /social/posts/:postId/reactions
     * Lấy danh sách tất cả reaction của một bài viết (không cần đăng nhập)
     * 
     * @param postId - ID của bài viết cần xem danh sách reaction
     * @returns Danh sách reaction kèm thông tin người dùng đã reaction
     */
    @Get('posts/:postId/reactions')
    listReactions(@Param('postId') postId: string) {
        return this.postService.listPostReactions(postId);
    }

    /**
     * [DELETE] /social/posts/:postId/reaction
     * Xóa reaction của người dùng khỏi bài viết
     * 
     * Yêu cầu xác thực JWT.
     * 
     * @param user - Thông tin người dùng đang đăng nhập
     * @param postId - ID của bài viết cần bỏ reaction
     * @returns Kết quả sau khi xóa reaction
     */
    @UseGuards(JwtAuthGuard)
    @Delete('posts/:postId/reaction')
    removeReaction(@CurrentUser() user: any, @Param('postId') postId: string) {
        return this.postService.removeReaction(user.id, postId);
    }
}