import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import { FriendshipService } from './friendship.service';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';

@Controller('api/social')
export class FriendshipController {
  constructor(private readonly friendshipService: FriendshipService) {}

  @Get('friends')
  @UseGuards(JwtAuthGuard)
  listFriends(@Req() req: any) {
    return this.friendshipService.listFriends(req.user.sub);
  }

  @Get('friends/pending')
  @UseGuards(JwtAuthGuard)
  listPendingRequests(@Req() req: any) {
    return this.friendshipService.listPendingRequests(req.user.sub);
  }

  @Post('friends/request')
  @UseGuards(JwtAuthGuard)
  sendRequest(@Body() body: { userId: number }, @Req() req: any) {
    return this.friendshipService.sendRequest(req.user.sub, body.userId);
  }

  @Post('friends/:userId/accept')
  @UseGuards(JwtAuthGuard)
  acceptRequest(@Param('userId') userId: string, @Req() req: any) {
    return this.friendshipService.acceptRequest(req.user.sub, parseInt(userId, 10));
  }

  @Delete('friends/:userId')
  @UseGuards(JwtAuthGuard)
  removeFriend(@Param('userId') userId: string, @Req() req: any) {
    return this.friendshipService.removeFriend(req.user.sub, parseInt(userId, 10));
  }

  @Get('users/search')
  @UseGuards(JwtAuthGuard)
  searchUsers(@Query('q') q: string) {
    return this.friendshipService.searchUsers(q || '', 20);
  }
}
