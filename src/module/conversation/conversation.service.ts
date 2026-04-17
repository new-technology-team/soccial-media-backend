import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ObjectId } from "mongodb";
import { Repository } from "typeorm";
import { Conversation } from "./conversation.entity";
import { UserService } from "../user/user.service";
import { FriendshipService } from "../friendship/friendship.service";

@Injectable()
export class ConversationService {
	constructor(
		@InjectRepository(Conversation, 'mongodb')
		private readonly conversationRepository: Repository<Conversation>,
		private readonly userService: UserService,
		private readonly friendshipService: FriendshipService,
	) {}

	private mapConversation(conversation: any, viewerId: number) {
		return {
			id: String(conversation._id),
			type: conversation.type,
			name: conversation.name,
			avatarUrl: conversation.avatarUrl || null,
			createdBy: conversation.createdBy,
			createdAt: conversation.createdAt,
			updatedAt: conversation.updatedAt,
			members: (conversation.members || []).map((member: any) => ({
				userId: member.userId,
				fullName: member.fullName,
				avatarUrl: member.avatarUrl || null,
				role: member.role || 'member',
				notificationsEnabled: member.notificationsEnabled !== false,
				lastReadAt: member.lastReadAt || null,
			})),
			lastMessage: conversation.lastMessage || null,
			unreadCount: 0,
			role: (conversation.members || []).find((item: any) => item.userId === viewerId)?.role || 'member',
			notificationsEnabled:
				(conversation.members || []).find((item: any) => item.userId === viewerId)?.notificationsEnabled !== false,
		};
	}

	async listConversations(userId: number) {
		const rows = await this.conversationRepository.find();
		const mine = rows.filter((item: any) => (item.members || []).some((m: any) => m.userId === userId));
		return { conversations: mine.map((item) => this.mapConversation(item, userId)) };
	}

	async createDirect(actorId: number, targetUserId: number) {
		if (actorId === targetUserId) {
			throw new BadRequestException('Không thể tạo hội thoại với chính mình');
		}

		const target = await this.userService.findOne(targetUserId);
		if (!target) {
			throw new NotFoundException('Người dùng không tồn tại');
		}

		const all = await this.conversationRepository.find();
		const existed = all.find(
			(item: any) =>
				item.type === 'direct' &&
				(item.members || []).length === 2 &&
				(item.members || []).some((m: any) => m.userId === actorId) &&
				(item.members || []).some((m: any) => m.userId === targetUserId),
		);

		if (existed) {
			return { conversation: this.mapConversation(existed, actorId) };
		}

		const actor = await this.userService.findOne(actorId);
		const now = new Date();
		const conversation = this.conversationRepository.create({
			type: 'direct',
			name: `${actor?.displayName || 'Bạn'} - ${target.displayName || 'Người dùng'}`,
			avatarUrl: null,
			createdBy: actorId,
			createdAt: now,
			updatedAt: now,
			members: [
				{
					userId: actorId,
					fullName: actor?.displayName || 'Bạn',
					avatarUrl: actor?.avatarUrl || null,
					role: 'admin',
					notificationsEnabled: true,
					lastReadAt: now,
				},
				{
					userId: targetUserId,
					fullName: target.displayName || 'Người dùng',
					avatarUrl: target.avatarUrl || null,
					role: 'member',
					notificationsEnabled: true,
					lastReadAt: null,
				},
			],
			lastMessage: null,
		});

		const saved = await this.conversationRepository.save(conversation);
		return { conversation: this.mapConversation(saved, actorId) };
	}

	async createGroup(actorId: number, name: string, avatarUrl: string | undefined, memberIds: number[]) {
		const groupName = String(name || '').trim();
		if (!groupName) {
			throw new BadRequestException('Tên nhóm không được để trống');
		}

		const actor = await this.userService.findOne(actorId);
		const uniqueMemberIds = [...new Set(memberIds.filter((item) => item !== actorId))];
		if (uniqueMemberIds.length === 0) {
			throw new BadRequestException('Nhóm cần ít nhất 1 thành viên khác');
		}

		const acceptedFriendIds = await this.friendshipService.getAcceptedFriendIds(actorId);
		const nonFriendIds = uniqueMemberIds.filter((id) => !acceptedFriendIds.has(id));
		if (nonFriendIds.length > 0) {
			throw new ForbiddenException('Chỉ có thể thêm bạn bè vào nhóm chat');
		}

		const members: any[] = [
			{
				userId: actorId,
				fullName: actor?.displayName || 'Bạn',
				avatarUrl: actor?.avatarUrl || null,
				role: 'admin',
				notificationsEnabled: true,
				lastReadAt: new Date(),
			},
		];

		for (const id of uniqueMemberIds) {
			const user = await this.userService.findOne(id);
			if (!user) {
				throw new NotFoundException(`Không tìm thấy user ${id}`);
			}
			members.push({
				userId: id,
				fullName: user.displayName,
				avatarUrl: user.avatarUrl || null,
				role: 'member',
				notificationsEnabled: true,
				lastReadAt: null,
			});
		}

		const now = new Date();
		const saved = await this.conversationRepository.save(
			this.conversationRepository.create({
				type: 'group',
				name: groupName,
				avatarUrl: avatarUrl || null,
				createdBy: actorId,
				createdAt: now,
				updatedAt: now,
				members,
				lastMessage: null,
			}),
		);

		return { conversation: this.mapConversation(saved, actorId) };
	}

	async getConversationById(conversationId: string) {
		return this.conversationRepository.findOne({ where: { _id: new ObjectId(conversationId) as any } });
	}

	async ensureMembership(conversationId: string, userId: number) {
		const conversation = await this.getConversationById(conversationId);
		if (!conversation) {
			throw new NotFoundException('Không tìm thấy hội thoại');
		}
		const joined = (conversation.members || []).some((item: any) => item.userId === userId);
		if (!joined) {
			throw new ForbiddenException('Bạn không thuộc cuộc trò chuyện này');
		}
		return conversation;
	}

	async getConversationDetail(conversationId: string, userId: number) {
		const conversation = await this.ensureMembership(conversationId, userId);
		return { conversation: this.mapConversation(conversation, userId) };
	}

	async setSeen(conversationId: string, userId: number) {
		const conversation = await this.ensureMembership(conversationId, userId);
		conversation.members = (conversation.members || []).map((item: any) =>
			item.userId === userId ? { ...item, lastReadAt: new Date() } : item,
		);
		await this.conversationRepository.save(conversation);
		return { message: 'Đã cập nhật trạng thái đã xem' };
	}

	async toggleNotifications(conversationId: string, userId: number, enabled: boolean) {
		const conversation = await this.ensureMembership(conversationId, userId);
		conversation.members = (conversation.members || []).map((item: any) =>
			item.userId === userId ? { ...item, notificationsEnabled: Boolean(enabled) } : item,
		);
		await this.conversationRepository.save(conversation);
		return { message: 'Đã cập nhật cài đặt thông báo' };
	}

	async addMember(conversationId: string, actorId: number, userId: number) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		const actor = (conversation.members || []).find((item: any) => item.userId === actorId);
		if (actor?.role !== 'admin') {
			throw new ForbiddenException('Chỉ admin mới có quyền thêm thành viên');
		}

		if ((conversation.members || []).some((item: any) => item.userId === userId)) {
			return { message: 'Người dùng đã ở trong nhóm' };
		}

		const user = await this.userService.findOne(userId);
		if (!user) {
			throw new NotFoundException('Người dùng không tồn tại');
		}

		conversation.members = [
			...(conversation.members || []),
			{
				userId,
				fullName: user.displayName,
				avatarUrl: user.avatarUrl || null,
				role: 'member',
				notificationsEnabled: true,
				lastReadAt: null,
			},
		];
		await this.conversationRepository.save(conversation);
		return { message: 'Đã thêm thành viên' };
	}

	async removeMember(conversationId: string, actorId: number, targetUserId: number) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		const actor = (conversation.members || []).find((item: any) => item.userId === actorId);
		if (actor?.role !== 'admin') {
			throw new ForbiddenException('Chỉ admin mới có quyền xóa thành viên');
		}

		conversation.members = (conversation.members || []).filter((item: any) => item.userId !== targetUserId);
		await this.conversationRepository.save(conversation);
		return { message: 'Đã xóa thành viên' };
	}

	async updateAdmin(conversationId: string, actorId: number, userId: number, isAdmin: boolean) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		const actor = (conversation.members || []).find((item: any) => item.userId === actorId);
		if (actor?.role !== 'admin') {
			throw new ForbiddenException('Chỉ admin mới có quyền thay đổi phân quyền');
		}

		conversation.members = (conversation.members || []).map((item: any) =>
			item.userId === userId ? { ...item, role: isAdmin ? 'admin' : 'member' } : item,
		);
		await this.conversationRepository.save(conversation);
		return { message: 'Đã cập nhật quyền thành viên' };
	}

	async dissolveGroup(conversationId: string, actorId: number) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ giải tán nhóm chat');
		}

		const actor = (conversation.members || []).find((item: any) => item.userId === actorId);
		if (actor?.role !== 'admin') {
			throw new ForbiddenException('Chỉ admin nhóm mới có quyền giải tán nhóm');
		}

		await this.conversationRepository.delete({ _id: new ObjectId(conversationId) as any });
		return { message: 'Đã giải tán nhóm chat' };
	}

	async touchLastMessage(conversationId: string, payload: any) {
		const conversation = await this.getConversationById(conversationId);
		if (!conversation) {
			return;
		}
		conversation.lastMessage = payload;
		conversation.updatedAt = new Date();
		await this.conversationRepository.save(conversation);
	}
}