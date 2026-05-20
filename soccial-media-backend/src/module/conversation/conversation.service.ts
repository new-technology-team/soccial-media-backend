import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from '../message/message.entity';
import { UserService } from '../user/user.service';
import { emitToConversation } from '../../common/socket/chat-socket';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation, 'mongodb')
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message, 'mongodb')
    private readonly messageRepo: Repository<Message>,
    private readonly userService: UserService,
  ) {}

  private toResponse(conv: Conversation, currentUserId?: number) {
    const lastMsg = conv.lastMessage;
    const otherMembers = (conv.members || []).filter(
      m => m.userId !== currentUserId,
    );

    return {
      id: String(conv._id),
      name: conv.conversationName || null,
      type: conv.type || (conv.conversationName ? 'group' : 'direct'),
      isGroup: Boolean(conv.conversationName),
      members: (conv.members || []).map(m => ({
        userId: m.userId,
        fullName: m.displayName,
        avatarUrl: m.avatarUrl,
        role: m.roleInConversation,
      })),
      lastMessage: lastMsg ? (lastMsg.text || lastMsg.content || '[Tin nhắn đa phương tiện]') : null,
      lastMessageAt: conv.lastMessageAt?.toISOString?.() ?? new Date().toISOString(),
      unreadCount: conv.unreadCount || 0,
    };
  }

  async createDirect(userId: number, targetUserId: number) {
    // Check if direct conversation already exists
    const existing = await this.convRepo.findOne({
      where: { type: 'direct', memberIds: { $all: [String(userId), String(targetUserId)] } } as any,
    });

    if (existing) {
      return { conversation: this.toResponse(existing, userId) };
    }

    const [user, targetUser] = await Promise.all([
      this.userService.findOne(userId),
      this.userService.findOne(targetUserId),
    ]);

    if (!user || !targetUser) throw new NotFoundException('User not found');

    const conv = this.convRepo.create({
      type: 'direct',
      conversationName: '',
      status: 'active',
      createdAt: new Date(),
      lastMessageAt: new Date(),
      members: [
        {
        userId: user.userId,
        displayName: user.fullName,
        avatarUrl: user.avatarUrl,
          roleInConversation: 'member' as any,
        },
        {
        userId: targetUser.userId,
        displayName: targetUser.fullName,
        avatarUrl: targetUser.avatarUrl,
          roleInConversation: 'member' as any,
        },
      ],
      memberIds: [String(user.userId), String(targetUser.userId)],
    });

    const saved = await this.convRepo.save(conv);
    return { conversation: this.toResponse(saved, userId) };
  }

  async createGroup(userId: number, name: string, memberIds: number[]) {
    const [creator, ...members] = await this.userService.findByIds([userId, ...memberIds]);
    if (!creator) throw new NotFoundException('User not found');

    const allMembers = [
      {
        userId: creator.userId,
        displayName: creator.fullName,
        avatarUrl: creator.avatarUrl,
        roleInConversation: 'admin' as any,
      },
      ...members.map(u => ({
        userId: u.userId,
        displayName: u.fullName,
        avatarUrl: u.avatarUrl,
        roleInConversation: 'member' as any,
      })),
    ];

    const conv = this.convRepo.create({
      type: 'group',
      conversationName: name,
      status: 'active',
      createdAt: new Date(),
      lastMessageAt: new Date(),
      members: allMembers,
      memberIds: [String(userId), ...memberIds.map(String)],
    });

    const saved = await this.convRepo.save(conv);
    return { conversation: this.toResponse(saved, userId) };
  }

  async listConversations(userId: number) {
    const conversations = await this.convRepo.find({
      where: { memberIds: String(userId) } as any,
      order: { lastMessageAt: 'DESC' },
    });

    return {
      conversations: conversations.map(c => this.toResponse(c, userId)),
    };
  }

  async getMessages(conversationId: string, userId: number, limit = 30) {
    const conv = await this.convRepo.findOne({
      where: { _id: this.toObjectId(conversationId) } as any,
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const isMember = (conv.members || []).some(m => m.userId === userId);
    if (!isMember) throw new BadRequestException('Not a member of this conversation');

    const messages = await this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return {
      messages: messages
        .map(m => this.toMessageResponse(m, userId))
        .reverse(),
    };
  }

  async sendMessage(conversationId: string, userId: number, data: {
    type?: string;
    text?: string;
    mediaUrl?: string;
  }) {
    const conv = await this.convRepo.findOne({
      where: { _id: this.toObjectId(conversationId) } as any,
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const isMember = (conv.members || []).some(m => m.userId === userId);
    if (!isMember) throw new BadRequestException('Not a member of this conversation');

    const user = await this.userService.findOne(userId);
    const content = data.text || data.mediaUrl ? `[${data.type || 'message'}]` : '';

    const message = this.messageRepo.create({
      conversationId,
      senderId: userId,
      senderName: user?.fullName || 'Người dùng',
      senderFullName: user?.fullName || 'Người dùng',
      senderAvatar: user?.avatarUrl,
      content: content || data.text || '',
      type: data.type || 'text',
      mediaUrl: data.mediaUrl || '',
      createdAt: new Date(),
      isRecalled: false,
    });

    const saved = await this.messageRepo.save(message);

    // Update conversation last message
    conv.lastMessageAt = new Date();
    await this.convRepo.save(conv);

    // Emit realtime event
    emitToConversation(conversationId, 'message:new', this.toMessageResponse(saved, userId));

    return { message: this.toMessageResponse(saved, userId) };
  }

  private toMessageResponse(msg: Message, currentUserId?: number) {
    return {
      id: String(msg._id),
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName: msg.senderName || msg.senderFullName || 'Người dùng',
      senderFullName: msg.senderFullName || msg.senderName || 'Người dùng',
      senderAvatar: msg.senderAvatar,
      content: msg.content,
      text: msg.content,
      type: msg.type,
      mediaUrl: msg.mediaUrl,
      isRecalled: msg.isRecalled,
      createdAt: msg.createdAt?.toISOString?.() ?? new Date().toISOString(),
      isMine: msg.senderId === currentUserId,
    };
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
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ thêm thành viên cho nhóm chat');
		}
		if (!this.isLeaderOrDeputy(conversation, actorId)) {
			throw new ForbiddenException('Chỉ trưởng nhóm hoặc phó nhóm mới có quyền thêm thành viên');
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
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ xóa thành viên cho nhóm chat');
		}
		if (!this.isLeaderOrDeputy(conversation, actorId)) {
			throw new ForbiddenException('Chỉ trưởng nhóm hoặc phó nhóm mới có quyền xóa thành viên');
		}

		if (!(conversation.members || []).some((item: any) => item.userId === targetUserId)) {
			throw new NotFoundException('Thành viên không tồn tại trong nhóm');
		}

		if (targetUserId === actorId) {
			throw new BadRequestException('Không thể tự xóa chính mình khỏi nhóm bằng chức năng này');
		}

		const target = this.getMemberByUserId(conversation, targetUserId);
		const actorRole = this.normalizeRole(this.getMemberByUserId(conversation, actorId)?.role);
		const targetRole = this.normalizeRole(target?.role);
		if (targetRole === 'leader') {
			throw new BadRequestException('Không thể xóa trưởng nhóm');
		}
		if (targetRole === 'deputy' && actorRole !== 'leader') {
			throw new ForbiddenException('Chỉ trưởng nhóm mới có thể xóa phó nhóm');
		}

		conversation.members = (conversation.members || []).filter((item: any) => item.userId !== targetUserId);
		await this.conversationRepository.save(conversation);
		return { message: 'Đã xóa thành viên' };
	}

	async leaveGroup(conversationId: string, actorId: number) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ rời khỏi nhóm chat');
		}

		const actor = this.getMemberByUserId(conversation, actorId);
		if (!actor) {
			throw new NotFoundException('Thành viên không tồn tại trong nhóm');
		}

		const actorRole = this.normalizeRole(actor.role);
		if (actorRole === 'leader') {
			const deputy = (conversation.members || []).find(
				(item: any) => this.normalizeRole(item.role) === 'deputy' && Number(item.userId) !== Number(actorId),
			);

			if (!deputy) {
				throw new BadRequestException('Trưởng nhóm cần chỉ định phó nhóm trước khi rời nhóm');
			}

			conversation.members = (conversation.members || [])
				.filter((item: any) => Number(item.userId) !== Number(actorId))
				.map((item: any) => {
					if (Number(item.userId) === Number(deputy.userId)) {
						return { ...item, role: 'leader' };
					}
					if (this.normalizeRole(item.role) === 'leader') {
						return { ...item, role: 'member' };
					}
					return item;
				});

			await this.conversationRepository.save(conversation);
			return { message: 'Bạn đã rời nhóm. Quyền trưởng nhóm đã được chuyển cho phó nhóm.' };
		}

		conversation.members = (conversation.members || []).filter((item: any) => Number(item.userId) !== Number(actorId));
		await this.conversationRepository.save(conversation);
		return { message: 'Bạn đã rời nhóm chat' };
	}

	async transferLeader(conversationId: string, actorId: number, targetUserId: number) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ chuyển quyền trưởng nhóm cho nhóm chat');
		}
		if (!this.isLeader(conversation, actorId)) {
			throw new ForbiddenException('Chỉ trưởng nhóm mới có quyền chuyển quyền trưởng nhóm');
		}
		if (Number(actorId) === Number(targetUserId)) {
			throw new BadRequestException('Không thể chuyển quyền cho chính mình');
		}

		const target = this.getMemberByUserId(conversation, targetUserId);
		if (!target) {
			throw new NotFoundException('Thành viên không tồn tại trong nhóm');
		}

		conversation.members = (conversation.members || []).map((item: any) => {
			if (Number(item.userId) === Number(actorId)) {
				return { ...item, role: 'member' };
			}
			if (Number(item.userId) === Number(targetUserId)) {
				return { ...item, role: 'leader' };
			}
			return this.normalizeRole(item.role) === 'leader' ? { ...item, role: 'member' } : item;
		});

		await this.conversationRepository.save(conversation);
		return { message: 'Đã chuyển quyền trưởng nhóm' };
	}

	async setDeputy(conversationId: string, actorId: number, targetUserId: number | null) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ cấp quyền phó nhóm cho nhóm chat');
		}
		if (!this.isLeader(conversation, actorId)) {
			throw new ForbiddenException('Chỉ trưởng nhóm mới có quyền cấp quyền phó nhóm');
		}

		const desiredDeputyId = targetUserId ? Number(targetUserId) : null;
		if (desiredDeputyId && Number(desiredDeputyId) === Number(actorId)) {
			throw new BadRequestException('Trưởng nhóm không thể tự đặt làm phó nhóm');
		}
		if (desiredDeputyId) {
			const target = this.getMemberByUserId(conversation, desiredDeputyId);
			if (!target) {
				throw new NotFoundException('Thành viên không tồn tại trong nhóm');
			}
			if (this.normalizeRole(target.role) === 'leader') {
				throw new BadRequestException('Không thể gán trưởng nhóm làm phó nhóm');
			}
		}

		conversation.members = (conversation.members || []).map((item: any) => {
			const uid = Number(item.userId);
			const role = this.normalizeRole(item.role);
			if (role === 'leader') return { ...item, role: 'leader' };
			if (desiredDeputyId && uid === desiredDeputyId) {
				return { ...item, role: 'deputy' };
			}
			if (role === 'deputy') {
				return { ...item, role: 'member' };
			}
			return { ...item, role: 'member' };
		});

		await this.conversationRepository.save(conversation);
		return { message: desiredDeputyId ? 'Đã cấp quyền phó nhóm' : 'Đã thu hồi quyền phó nhóm' };
	}

	async updateAdmin(conversationId: string, actorId: number, userId: number, isAdmin: boolean) {
		// Backward-compat endpoint: map admin=true to deputy, admin=false to remove deputy.
		return this.setDeputy(conversationId, actorId, isAdmin ? Number(userId) : null);
	}

	async dissolveGroup(conversationId: string, actorId: number) {
		const conversation = await this.ensureMembership(conversationId, actorId);
		if (conversation.type !== 'group') {
			throw new BadRequestException('Chỉ hỗ trợ giải tán nhóm chat');
		}

		if (!this.isLeader(conversation, actorId)) {
			throw new ForbiddenException('Chỉ trưởng nhóm mới có quyền giải tán nhóm');
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

	async pinMessage(conversationId: string, userId: number, messageId: string) {
		const conversation = await this.ensureMembership(conversationId, userId);
		const pinnedMessageIds = new Set<string>((conversation.pinnedMessageIds || []).map((item: any) => String(item)));
		pinnedMessageIds.add(String(messageId));
		conversation.pinnedMessageIds = Array.from(pinnedMessageIds);
		await this.conversationRepository.save(conversation);
		return { message: 'Đã ghim tin nhắn' };
	}

	async unpinMessage(conversationId: string, userId: number, messageId: string) {
		const conversation = await this.ensureMembership(conversationId, userId);
		const pinnedMessageIds = new Set<string>((conversation.pinnedMessageIds || []).map((item: any) => String(item)));
		pinnedMessageIds.delete(String(messageId));
		conversation.pinnedMessageIds = Array.from(pinnedMessageIds);
		await this.conversationRepository.save(conversation);
		return { message: 'Đã bỏ ghim tin nhắn' };
	}
}