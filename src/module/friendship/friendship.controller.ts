import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { FriendshipService } from './friendship.service';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';

@Controller('api/social')
export class FriendshipController {
  constructor(private readonly friendshipService: FriendshipService) {}

  @Get('friends')
  @UseGuards(JwtAuthGuard)
  async listFriends(@Req() req: any) {
    const friends = await this.friendshipService.listFriends(req.user.sub);
    return { friends };
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
    return this.friendshipService.acceptRequest(
      req.user.sub,
      parseInt(userId, 10),
    );
  }

  @Post('friends/:userId/reject')
  @UseGuards(JwtAuthGuard)
  rejectRequest(@Param('userId') userId: string, @Req() req: any) {
    return this.friendshipService.rejectRequest(
      req.user.sub,
      parseInt(userId, 10),
    );
  }

  @Delete('friends/:userId')
  @UseGuards(JwtAuthGuard)
  removeFriend(@Param('userId') userId: string, @Req() req: any) {
    return this.friendshipService.removeFriend(
      req.user.sub,
      parseInt(userId, 10),
    );
  }

  @Get('users/search')
  @UseGuards(JwtAuthGuard)
  async searchUsers(@Query('q') q: string) {
    const users = await this.friendshipService.searchUsers(q || '', 20);
    return { users };
  }

  @Get('users/:userId/profile')
  @UseGuards(JwtAuthGuard)
  getUserProfile(@Param('userId') userId: string, @Req() req: any) {
    return this.friendshipService.getUserProfile(
      req.user.sub,
      parseInt(userId, 10),
    );
  }
}
