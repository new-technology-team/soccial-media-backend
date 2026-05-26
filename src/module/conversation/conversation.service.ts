import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectId } from 'mongodb';
import { Repository } from 'typeorm';
import { emitToConversation } from '../../common/socket/chat-socket';
import { Message } from '../message/message.entity';
import { UserService } from '../user/user.service';
import { UserBlock } from '../user/user-block.entity';
import { Conversation } from './conversation.entity';

type MemberLike = {
  userId: number;
  displayName?: string;
  fullName?: string;
  avatarUrl?: string | null;
  role?: string;
  roleInConversation?: string;
  notificationsEnabled?: boolean;
  lastReadAt?: Date | null;
};

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation, 'mongodb')
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message, 'mongodb')
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(UserBlock, 'mariadb')
    private readonly userBlockRepo: Repository<UserBlock>,
    private readonly userService: UserService,
  ) {}

  private toObjectId(value: string) {
    if (!ObjectId.isValid(value)) {
      throw new BadRequestException('Conversation id không hợp lệ');
    }
    return new ObjectId(value);
  }

  private normalizeRole(role: unknown) {
    const value = String(role || '').toLowerCase();
    if (['owner', 'leader', 'admin'].includes(value)) return 'leader';
    if (value === 'deputy') return 'deputy';
    return 'member';
  }

  private getMemberRole(member?: MemberLike) {
    return this.normalizeRole(member?.role ?? member?.roleInConversation);
  }

  private getMemberByUserId(conversation: Conversation, userId: number) {
    return ((conversation.members || []) as MemberLike[]).find(
      (item) => Number(item.userId) === Number(userId),
    );
  }

  private isLeader(conversation: Conversation, userId: number) {
    return (
      this.getMemberRole(this.getMemberByUserId(conversation, userId)) ===
      'leader'
    );
  }

  private isLeaderOrDeputy(conversation: Conversation, userId: number) {
    const role = this.getMemberRole(
      this.getMemberByUserId(conversation, userId),
    );
    return role === 'leader' || role === 'deputy';
  }

  private toResponse(conv: Conversation, currentUserId?: number) {
    const lastMsg = conv.lastMessage;
    const members = (conv.members || []) as MemberLike[];
    const currentMember =
      currentUserId !== undefined
        ? members.find((member) => Number(member.userId) === Number(currentUserId))
        : undefined;
    const isGroup =
      conv.type === 'group' ||
      Boolean(String(conv.conversationName || '').trim());
    const directPeer = !isGroup
      ? members.find(
          (member) => Number(member.userId) !== Number(currentUserId),
        )
      : undefined;
    const displayName = isGroup
      ? conv.conversationName || null
      : directPeer?.displayName || directPeer?.fullName || null;

    return {
      id: String(conv._id),
      name: displayName,
      type: conv.type || (conv.conversationName ? 'group' : 'direct'),
      isGroup,
      members: members.map((member) => ({
        userId: member.userId,
        fullName: member.displayName || member.fullName || 'Người dùng',
        avatarUrl: member.avatarUrl || null,
        role: this.getMemberRole(member),
        notificationsEnabled:
          member.notificationsEnabled === undefined
            ? true
            : Boolean(member.notificationsEnabled),
      })),
      lastMessage: lastMsg
        ? lastMsg.text || lastMsg.content || '[Tin nhắn đa phương tiện]'
        : null,
      lastMessageAt:
        conv.lastMessageAt?.toISOString?.() ?? new Date().toISOString(),
      unreadCount: conv.unreadCount || 0,
      viewerSettings: {
        notificationsEnabled:
          currentMember?.notificationsEnabled === undefined
            ? true
            : Boolean(currentMember?.notificationsEnabled),
      },
      isMine: currentUserId
        ? (conv.members || []).some((member) => member.userId === currentUserId)
        : false,
    };
  }

  private getDirectPeerUserId(conversation: Conversation, userId: number) {
    if (conversation.type === 'group') return null;
    const peer = ((conversation.members || []) as MemberLike[]).find(
      (member) => Number(member.userId) !== Number(userId),
    );
    return peer ? Number(peer.userId) : null;
  }

  private async getBlockFlags(viewerId: number, peerUserId: number) {
    const [blockedByMe, blockedMe] = await Promise.all([
      this.userBlockRepo.findOne({
        where: {
          blockerUserId: Number(viewerId),
          blockedUserId: Number(peerUserId),
        },
      }),
      this.userBlockRepo.findOne({
        where: {
          blockerUserId: Number(peerUserId),
          blockedUserId: Number(viewerId),
        },
      }),
    ]);

    return {
      isBlockedByMe: Boolean(blockedByMe),
      isBlockedMe: Boolean(blockedMe),
    };
  }

  private async ensureDirectMessageAllowed(
    conversation: Conversation,
    userId: number,
  ) {
    const peerUserId = this.getDirectPeerUserId(conversation, userId);
    if (!peerUserId) return;

    const { isBlockedByMe, isBlockedMe } = await this.getBlockFlags(
      userId,
      peerUserId,
    );

    if (isBlockedByMe || isBlockedMe) {
      throw new ForbiddenException(
        'Khong the gui tin nhan vi mot trong hai ben da chan nhau',
      );
    }
  }

  private toMessageResponse(msg: Message, currentUserId?: number) {
    return {
      id: String(msg._id),
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName: msg.senderName || msg.senderFullName || 'Người dùng',
      senderFullName: msg.senderFullName || msg.senderName || 'Người dùng',
      senderAvatar: msg.senderAvatar,
      content: msg.isRecalled ? 'Tin nhan da duoc thu hoi' : msg.content,
      text: msg.isRecalled ? 'Tin nhan da duoc thu hoi' : msg.content,
      type: msg.type,
      mediaUrl: msg.mediaUrl,
      isRecalled: msg.isRecalled,
      isRemovedForMe: Boolean(
        (msg.removedForUserIds || []).some(
          (id) => Number(id) === Number(currentUserId),
        ),
      ),
      createdAt: msg.createdAt?.toISOString?.() ?? new Date().toISOString(),
      isMine: msg.senderId === currentUserId,
    };
  }

  private async getConversationById(conversationId: string) {
    return this.convRepo.findOne({
      where: { _id: this.toObjectId(conversationId) } as any,
    });
  }

  private async ensureMembership(conversationId: string, userId: number) {
    const conversation = await this.getConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    }

    const joined = (conversation.members || []).some(
      (item) => Number(item.userId) === Number(userId),
    );
    if (!joined) {
      throw new ForbiddenException('Bạn không thuộc cuộc trò chuyện này');
    }

    return conversation;
  }

  async createDirect(userId: number, targetUserId: number) {
    if (Number(userId) === Number(targetUserId)) {
      throw new BadRequestException('Khong the tao hoi thoai voi chinh minh');
    }

    const blockFlags = await this.getBlockFlags(userId, targetUserId);
    if (blockFlags.isBlockedByMe || blockFlags.isBlockedMe) {
      throw new ForbiddenException(
        'Khong the tao hoi thoai vi mot trong hai ben da chan nhau',
      );
    }

    const [user, targetUser] = await Promise.all([
      this.userService.findOne(userId),
      this.userService.findOne(targetUserId),
    ]);

    if (!user || !targetUser) throw new NotFoundException('User not found');

    const members = [
      {
        userId: user.userId,
        displayName: user.fullName,
        avatarUrl: user.avatarUrl,
        roleInConversation: 'MEMBER',
      },
      {
        userId: targetUser.userId,
        displayName: targetUser.fullName,
        avatarUrl: targetUser.avatarUrl,
        roleInConversation: 'MEMBER',
      },
    ] as any;

    const memberIds = [String(user.userId), String(targetUser.userId)];
    const existing = await this.convRepo.findOne({
      where: {
        type: 'direct',
        memberIds: { $all: memberIds },
      } as any,
    });

    if (existing) {
      const existingMembers = (existing.members || []) as MemberLike[];
      const hasBothMembers = [user.userId, targetUser.userId].every((id) =>
        existingMembers.some((member) => Number(member.userId) === Number(id)),
      );

      if (!hasBothMembers) {
        existing.members = members;
        existing.memberIds = memberIds;
        existing.type = 'direct';
        existing.status = existing.status || 'active';
        await this.convRepo.save(existing);
      }

      return { conversation: this.toResponse(existing, userId) };
    }

    const conv = this.convRepo.create({
      type: 'direct',
      conversationName: '',
      status: 'active',
      createdAt: new Date(),
      lastMessageAt: new Date(),
      members,
      memberIds,
    });

    const saved = await this.convRepo.save(conv);
    return { conversation: this.toResponse(saved, userId) };
  }

  async createGroup(userId: number, name: string, memberIds: number[]) {
    const normalizedMemberIds = Array.from(
      new Set(
        (memberIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0 && id !== Number(userId)),
      ),
    );

    if (normalizedMemberIds.length < 2) {
      throw new BadRequestException(
        'Nhom chat can it nhat 3 nguoi (bao gom ban va 2 thanh vien khac)',
      );
    }

    const creator = await this.userService.findOne(userId);
    if (!creator) throw new NotFoundException('User not found');

    const members = await this.userService.findByIds(normalizedMemberIds);
    if (members.length !== normalizedMemberIds.length) {
      throw new NotFoundException('Mot so thanh vien khong ton tai');
    }

    const allMembers = [
      {
        userId: creator.userId,
        displayName: creator.fullName,
        avatarUrl: creator.avatarUrl,
        roleInConversation: 'OWNER',
      },
      ...members.map((user) => ({
        userId: user.userId,
        displayName: user.fullName,
        avatarUrl: user.avatarUrl,
        roleInConversation: 'MEMBER',
      })),
    ];

    const conv = this.convRepo.create({
      type: 'group',
      conversationName: name,
      status: 'active',
      createdAt: new Date(),
      lastMessageAt: new Date(),
      members: allMembers as any,
      memberIds: [String(userId), ...normalizedMemberIds.map(String)],
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
      conversations: conversations.map((conversation) =>
        this.toResponse(conversation, userId),
      ),
    };
  }

  async getConversationDetail(conversationId: string, userId: number) {
    const conversation = await this.ensureMembership(conversationId, userId);
    const response = this.toResponse(conversation, userId) as any;
    const peerUserId = this.getDirectPeerUserId(conversation, userId);

    if (peerUserId) {
      const blockFlags = await this.getBlockFlags(userId, peerUserId);
      response.directPeerId = peerUserId;
      response.isBlockedByMe = blockFlags.isBlockedByMe;
      response.isBlockedMe = blockFlags.isBlockedMe;
    } else {
      response.directPeerId = null;
      response.isBlockedByMe = false;
      response.isBlockedMe = false;
    }

    return { conversation: response };
  }

  async getMessages(conversationId: string, userId: number, limit = 30) {
    await this.ensureMembership(conversationId, userId);

    const messages = await this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return {
      messages: messages
        .filter(
          (message) =>
            !(message.removedForUserIds || []).some(
              (id) => Number(id) === Number(userId),
            ),
        )
        .map((message) => this.toMessageResponse(message, userId))
        .reverse(),
    };
  }

  async sendMessage(
    conversationId: string,
    userId: number,
    data: {
      type?: string;
      text?: string;
      mediaUrl?: string;
    },
  ) {
    const conversation = await this.ensureMembership(conversationId, userId);
    await this.ensureDirectMessageAllowed(conversation, userId);
    const user = await this.userService.findOne(userId);
    const content =
      data.text || (data.mediaUrl ? `[${data.type || 'message'}]` : '');

    const message = this.messageRepo.create({
      conversationId,
      senderId: userId,
      senderName: user?.fullName || 'Người dùng',
      senderFullName: user?.fullName || 'Người dùng',
      senderAvatar: user?.avatarUrl,
      content,
      type: data.type || 'text',
      mediaUrl: data.mediaUrl || '',
      createdAt: new Date(),
      isRecalled: false,
      removedForUserIds: [],
    });

    const saved = await this.messageRepo.save(message);

    conversation.lastMessage = {
      text: saved.content,
      content: saved.content,
      senderId: saved.senderId,
      createdAt: saved.createdAt,
    };
    conversation.lastMessageAt = new Date();
    await this.convRepo.save(conversation);

    emitToConversation(
      conversationId,
      'message:new',
      this.toMessageResponse(saved, userId),
    );

    return { message: this.toMessageResponse(saved, userId) };
  }

  async recallMessage(
    conversationId: string,
    messageId: string,
    userId: number,
    scope: 'me' | 'all',
  ) {
    await this.ensureMembership(conversationId, userId);

    const message = await this.messageRepo.findOne({
      where: {
        _id: this.toObjectId(messageId),
        conversationId,
      } as any,
    });

    if (!message) {
      throw new NotFoundException('Khong tim thay tin nhan');
    }

    if (scope === 'all') {
      if (Number(message.senderId) !== Number(userId)) {
        throw new ForbiddenException('Ban chi co the thu hoi tin cua minh');
      }

      message.isRecalled = true;
      message.content = 'Tin nhan da duoc thu hoi';
      message.mediaUrl = '';
      const saved = await this.messageRepo.save(message);

      emitToConversation(
        conversationId,
        'message:updated',
        this.toMessageResponse(saved, userId),
      );

      return { message: this.toMessageResponse(saved, userId), removed: false };
    }

    const removedFor = new Set<number>([
      ...((message.removedForUserIds || []).map((id) => Number(id)) || []),
      Number(userId),
    ]);
    message.removedForUserIds = Array.from(removedFor);
    await this.messageRepo.save(message);

    emitToConversation(conversationId, 'message:updated', {
      id: String(message._id),
      conversationId,
      removedForUserId: Number(userId),
    });

    return { id: String(message._id), removed: true };
  }

  async setSeen(conversationId: string, userId: number) {
    const conversation = await this.ensureMembership(conversationId, userId);
    conversation.members = ((conversation.members || []) as MemberLike[]).map(
      (item) =>
        Number(item.userId) === Number(userId)
          ? ({ ...item, lastReadAt: new Date() } as any)
          : (item as any),
    );
    await this.convRepo.save(conversation);
    return { message: 'Đã cập nhật trạng thái đã xem' };
  }

  async toggleNotifications(
    conversationId: string,
    userId: number,
    enabled: boolean,
  ) {
    const conversation = await this.ensureMembership(conversationId, userId);
    conversation.members = ((conversation.members || []) as MemberLike[]).map(
      (item) =>
        Number(item.userId) === Number(userId)
          ? ({ ...item, notificationsEnabled: Boolean(enabled) } as any)
          : (item as any),
    );
    await this.convRepo.save(conversation);
    return { message: 'Đã cập nhật cài đặt thông báo' };
  }

  async addMember(conversationId: string, actorId: number, userId: number) {
    const conversation = await this.ensureMembership(conversationId, actorId);
    if (conversation.type !== 'group') {
      throw new BadRequestException('Chỉ hỗ trợ thêm thành viên cho nhóm chat');
    }
    if (!this.isLeaderOrDeputy(conversation, actorId)) {
      throw new ForbiddenException(
        'Chỉ trưởng nhóm hoặc phó nhóm mới có quyền thêm thành viên',
      );
    }

    if (
      (conversation.members || []).some(
        (item) => Number(item.userId) === Number(userId),
      )
    ) {
      return { message: 'Người dùng đã ở trong nhóm' };
    }

    const user = await this.userService.findOne(userId);
    if (!user) throw new NotFoundException('Người dùng không tồn tại');

    conversation.members = [
      ...((conversation.members || []) as any[]),
      {
        userId,
        displayName: user.fullName,
        avatarUrl: user.avatarUrl || null,
        roleInConversation: 'MEMBER',
        notificationsEnabled: true,
        lastReadAt: null,
      },
    ] as any;
    conversation.memberIds = [
      ...new Set([...(conversation.memberIds || []), String(userId)]),
    ];
    await this.convRepo.save(conversation);
    return { message: 'Đã thêm thành viên' };
  }

  async removeMember(
    conversationId: string,
    actorId: number,
    targetUserId: number,
  ) {
    const conversation = await this.ensureMembership(conversationId, actorId);
    if (conversation.type !== 'group') {
      throw new BadRequestException('Chỉ hỗ trợ xóa thành viên cho nhóm chat');
    }
    if (!this.isLeaderOrDeputy(conversation, actorId)) {
      throw new ForbiddenException(
        'Chỉ trưởng nhóm hoặc phó nhóm mới có quyền xóa thành viên',
      );
    }

    const target = this.getMemberByUserId(conversation, targetUserId);
    if (!target)
      throw new NotFoundException('Thành viên không tồn tại trong nhóm');
    if (Number(targetUserId) === Number(actorId)) {
      throw new BadRequestException(
        'Không thể tự xóa chính mình khỏi nhóm bằng chức năng này',
      );
    }

    const actorRole = this.getMemberRole(
      this.getMemberByUserId(conversation, actorId),
    );
    const targetRole = this.getMemberRole(target);
    if (targetRole === 'leader')
      throw new BadRequestException('Không thể xóa trưởng nhóm');
    if (targetRole === 'deputy' && actorRole !== 'leader') {
      throw new ForbiddenException('Chỉ trưởng nhóm mới có thể xóa phó nhóm');
    }

    conversation.members = (conversation.members || []).filter(
      (item) => Number(item.userId) !== Number(targetUserId),
    );
    conversation.memberIds = (conversation.memberIds || []).filter(
      (id) => String(id) !== String(targetUserId),
    );
    await this.convRepo.save(conversation);
    return { message: 'Đã xóa thành viên' };
  }

  async leaveGroup(conversationId: string, actorId: number) {
    const conversation = await this.ensureMembership(conversationId, actorId);
    if (conversation.type !== 'group') {
      throw new BadRequestException('Chỉ hỗ trợ rời khỏi nhóm chat');
    }

    const actor = this.getMemberByUserId(conversation, actorId);
    if (!actor)
      throw new NotFoundException('Thành viên không tồn tại trong nhóm');

    if (this.getMemberRole(actor) === 'leader') {
      const deputy = ((conversation.members || []) as MemberLike[]).find(
        (item) =>
          this.getMemberRole(item) === 'deputy' &&
          Number(item.userId) !== Number(actorId),
      );
      if (!deputy) {
        throw new BadRequestException(
          'Trưởng nhóm cần chỉ định phó nhóm trước khi rời nhóm',
        );
      }

      conversation.members = ((conversation.members || []) as MemberLike[])
        .filter((item) => Number(item.userId) !== Number(actorId))
        .map((item) =>
          Number(item.userId) === Number(deputy.userId)
            ? ({ ...item, roleInConversation: 'OWNER' } as any)
            : (item as any),
        );
    } else {
      conversation.members = (conversation.members || []).filter(
        (item) => Number(item.userId) !== Number(actorId),
      );
    }

    conversation.memberIds = (conversation.memberIds || []).filter(
      (id) => String(id) !== String(actorId),
    );
    await this.convRepo.save(conversation);
    return { message: 'Bạn đã rời nhóm chat' };
  }

  async transferLeader(
    conversationId: string,
    actorId: number,
    targetUserId: number,
  ) {
    const conversation = await this.ensureMembership(conversationId, actorId);
    if (conversation.type !== 'group') {
      throw new BadRequestException(
        'Chỉ hỗ trợ chuyển quyền trưởng nhóm cho nhóm chat',
      );
    }
    if (!this.isLeader(conversation, actorId)) {
      throw new ForbiddenException(
        'Chỉ trưởng nhóm mới có quyền chuyển quyền trưởng nhóm',
      );
    }
    if (Number(actorId) === Number(targetUserId)) {
      throw new BadRequestException('Không thể chuyển quyền cho chính mình');
    }
    if (!this.getMemberByUserId(conversation, targetUserId)) {
      throw new NotFoundException('Thành viên không tồn tại trong nhóm');
    }

    conversation.members = ((conversation.members || []) as MemberLike[]).map(
      (item) => {
        if (Number(item.userId) === Number(actorId)) {
          return { ...item, roleInConversation: 'MEMBER' } as any;
        }
        if (Number(item.userId) === Number(targetUserId)) {
          return { ...item, roleInConversation: 'OWNER' } as any;
        }
        return item as any;
      },
    );
    await this.convRepo.save(conversation);
    return { message: 'Đã chuyển quyền trưởng nhóm' };
  }

  async setDeputy(
    conversationId: string,
    actorId: number,
    targetUserId: number | null,
  ) {
    const conversation = await this.ensureMembership(conversationId, actorId);
    if (conversation.type !== 'group') {
      throw new BadRequestException(
        'Chỉ hỗ trợ cấp quyền phó nhóm cho nhóm chat',
      );
    }
    if (!this.isLeader(conversation, actorId)) {
      throw new ForbiddenException(
        'Chỉ trưởng nhóm mới có quyền cấp quyền phó nhóm',
      );
    }

    const deputyId = targetUserId ? Number(targetUserId) : null;
    if (deputyId && deputyId === Number(actorId)) {
      throw new BadRequestException(
        'Trưởng nhóm không thể tự đặt làm phó nhóm',
      );
    }
    if (deputyId && !this.getMemberByUserId(conversation, deputyId)) {
      throw new NotFoundException('Thành viên không tồn tại trong nhóm');
    }

    conversation.members = ((conversation.members || []) as MemberLike[]).map(
      (item) => {
        const role = this.getMemberRole(item);
        if (role === 'leader')
          return { ...item, roleInConversation: 'OWNER' } as any;
        if (deputyId && Number(item.userId) === deputyId) {
          return { ...item, roleInConversation: 'deputy' } as any;
        }
        if (role === 'deputy')
          return { ...item, roleInConversation: 'MEMBER' } as any;
        return item as any;
      },
    );
    await this.convRepo.save(conversation);
    return {
      message: deputyId ? 'Đã cấp quyền phó nhóm' : 'Đã thu hồi quyền phó nhóm',
    };
  }

  async updateAdmin(
    conversationId: string,
    actorId: number,
    userId: number,
    isAdmin: boolean,
  ) {
    return this.setDeputy(
      conversationId,
      actorId,
      isAdmin ? Number(userId) : null,
    );
  }

  async dissolveGroup(conversationId: string, actorId: number) {
    const conversation = await this.ensureMembership(conversationId, actorId);
    if (conversation.type !== 'group') {
      throw new BadRequestException('Chỉ hỗ trợ giải tán nhóm chat');
    }
    if (!this.isLeader(conversation, actorId)) {
      throw new ForbiddenException(
        'Chỉ trưởng nhóm mới có quyền giải tán nhóm',
      );
    }

    await this.convRepo.delete({ _id: this.toObjectId(conversationId) } as any);
    return { message: 'Đã giải tán nhóm chat' };
  }

  async touchLastMessage(conversationId: string, payload: any) {
    const conversation = await this.getConversationById(conversationId);
    if (!conversation) return;

    conversation.lastMessage = payload;
    conversation.lastMessageAt = new Date();
    (conversation as any).updatedAt = new Date();
    await this.convRepo.save(conversation);
  }

  async pinMessage(conversationId: string, userId: number, messageId: string) {
    const conversation = await this.ensureMembership(conversationId, userId);
    const pinnedMessageIds = new Set<string>(
      ((conversation as any).pinnedMessageIds || []).map((item: any) =>
        String(item),
      ),
    );
    pinnedMessageIds.add(String(messageId));
    (conversation as any).pinnedMessageIds = Array.from(pinnedMessageIds);
    await this.convRepo.save(conversation);
    return { message: 'Đã ghim tin nhắn' };
  }

  async unpinMessage(
    conversationId: string,
    userId: number,
    messageId: string,
  ) {
    const conversation = await this.ensureMembership(conversationId, userId);
    const pinnedMessageIds = new Set<string>(
      ((conversation as any).pinnedMessageIds || []).map((item: any) =>
        String(item),
      ),
    );
    pinnedMessageIds.delete(String(messageId));
    (conversation as any).pinnedMessageIds = Array.from(pinnedMessageIds);
    await this.convRepo.save(conversation);
    return { message: 'Đã bỏ ghim tin nhắn' };
  }
}
