import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { FriendshipService } from "./friendship.service";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { UserService } from "../user/user.service";

@Controller('social')
@UseGuards(JwtAuthGuard)
export class FriendshipController {
	constructor(
		private readonly friendshipService: FriendshipService,
		private readonly userService: UserService,
	) {}

	@Get('friends')
	listFriends(@CurrentUser() user: any) {
		return this.friendshipService.listFriends(user.id);
	}

	@Get('friends/requests')
	listIncomingRequests(@CurrentUser() user: any) {
		return this.friendshipService.listIncomingRequests(user.id);
	}

	@Get('users/search')
	async findUsers(@CurrentUser() user: any, @Query('q') q: string) {
		const rows = await this.userService.searchUsers(String(q || '').trim(), user.id);
		return {
			users: rows.map((item) => ({
				id: item.userId,
				fullName: item.displayName,
				avatarUrl: item.avatarUrl,
				email: item.email,
				phone: item.phone,
				role: item.role,
				accountStatus: item.status,
			})),
		};
	}

	@Post('friends/request')
	requestFriend(@CurrentUser() user: any, @Body() body: { userId: number }) {
		return this.friendshipService.requestFriend(user.id, Number(body.userId), user.fullName);
	}

	@Post('friends/:userId/accept')
	acceptFriend(@CurrentUser() user: any, @Param('userId') userId: string) {
		return this.friendshipService.acceptFriend(user.id, Number(userId), user.fullName);
	}

	@Delete('friends/:userId')
	deleteFriend(@CurrentUser() user: any, @Param('userId') userId: string) {
		return this.friendshipService.deleteFriend(user.id, Number(userId));
	}

	@Post('users/:userId/block')
	blockUser(@CurrentUser() user: any, @Param('userId') userId: string) {
		return this.friendshipService.blockUser(user.id, Number(userId));
	}

	@Get('users/:userId/block')
	isBlocked(@CurrentUser() user: any, @Param('userId') userId: string) {
		return this.friendshipService.isBlockedBy(user.id, Number(userId)).then((blocked) => ({ blocked }));
	}

	@Delete('users/:userId/block')
	unblockUser(@CurrentUser() user: any, @Param('userId') userId: string) {
		return this.friendshipService.unblockUser(user.id, Number(userId));
	}
}
