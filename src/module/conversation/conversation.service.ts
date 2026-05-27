import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectId } from 'mongodb';
import { Repository } from 'typeorm';
import { emitToConversation, emitToUsers } from '../../common/socket/chat-socket';
import { Message } from '../message/message.entity';
import { NotificationService } from '../notification/notification.service';
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
    private readonly notificationService: NotificationService,
  ) {}

  private toObjectId(value: string) {
    if (!ObjectId.isValid(value)) {
      throw new BadRequestException('Conversation id khong hop le');
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

  private getMemberName(member?: MemberLike, fallback = 'Nguoi dung') {
    return String(member?.displayName || member?.fullName || fallback);
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

  private getConversationMemberIds(conversation: Conversation) {
    return ((conversation.members || []) as MemberLike[])
      .map((member) => Number(member.userId))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  private async notifyUsers(
    userIds: number[],
    payload: {
      type: string;
      title: string;
      content: string;
      meta?: Record<string, any> | null;
    },
  ) {
    const uniqueIds = Array.from(
      new Set(
        (userIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );

    if (!uniqueIds.length) return;

    await Promise.all(
      uniqueIds.map((userId) =>
        this.notificationService
          .create({
            userId,
            type: payload.type,
            title: payload.title,
            content: payload.content,
            link: '/messages',
            meta: payload.meta || null,
          })
          .catch(() => undefined),
      ),
    );
  }

  private toResponse(conv: Conversation, currentUserId?: number) {
    const lastMsg = conv.lastMessage;
    const members = (conv.members || []) as MemberLike[];
    const currentMember =
      currentUserId !== undefined
        ? members.find(
            (member) => Number(member.userId) === Number(currentUserId),
          )
        : undefined;

    const normalizedType = String(conv.type || '').trim().toLowerCase();
    const inferredType = normalizedType
      ? normalizedType
      : Number((conv.members || []).length || 0) > 2
        ? 'group'
        : 'direct';
    const isGroup = inferredType === 'group';

    const directPeer = !isGroup
      ? members.find(
          (member) => Number(member.userId) !== Number(currentUserId),
        )
      : undefined;

    const displayName = isGroup
      ? conv.conversationName || null
      : directPeer?.displayName || directPeer?.fullName || null;

    const displayAvatar = isGroup
      ? conv.avatarUrl || null
      : directPeer?.avatarUrl || null;

    return {
      id: String(conv._id),
      name: displayName,
      avatarUrl: displayAvatar,
      type: inferredType,
      isGroup,
      members: members.map((member) => ({
        userId: member.userId,
        fullName: this.getMemberName(member),
        avatarUrl: member.avatarUrl || null,
        role: this.getMemberRole(member),
        notificationsEnabled:
          member.notificationsEnabled === undefined
            ? true
            : Boolean(member.notificationsEnabled),
      })),
      lastMessage: lastMsg
        ? lastMsg.text || lastMsg.content || '[Tin nhan da phuong tien]'
        : null,
      lastMessageAt:
        conv.lastMessageAt?.toISOString?.() ?? new Date().toISOString(),
      unreadCount: Number(conv.unreadCount || 0),
      viewerSettings: {
        notificationsEnabled:
          currentMember?.notificationsEnabled === undefined
            ? true
            : Boolean(currentMember?.notificationsEnabled),
      },
      isMine: currentUserId
        ? (conv.members || []).some(
            (member) => Number(member.userId) === Number(currentUserId),
          )
        : false,
    };
  }

  private getDirectPeerUserId(conversation: Conversation, userId: number) {
    const members = (conversation.members || []) as MemberLike[];
    const normalizedType = String(conversation.type || '').toLowerCase();
    if (normalizedType === 'group' || members.length > 2) return null;
    const peer = members.find(
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
    const recalledText = 'Tin nhan da duoc thu hoi';
    return {
      id: String(msg._id),
      conversationId: msg.conversationId,
      senderId: Number(msg.senderId || 0),
      senderName: msg.senderName || msg.senderFullName || 'Nguoi dung',
      senderFullName: msg.senderFullName || msg.senderName || 'Nguoi dung',
      senderAvatar: msg.senderAvatar || null,
      content: msg.isRecalled ? recalledText : msg.content,
      text: msg.isRecalled ? recalledText : msg.content,
      type: msg.type || 'text',
      mediaUrl: msg.mediaUrl || '',
      fileName: msg.fileName || '',
      fileSize: Number(msg.fileSize || 0),
      meta: msg.meta || null,
      isRecalled: Boolean(msg.isRecalled),
      isRemovedForMe: Boolean(
        (msg.removedForUserIds || []).some(
          (id) => Number(id) === Number(currentUserId),
        ),
      ),
      createdAt: msg.createdAt?.toISOString?.() ?? new Date().toISOString(),
      isMine: Number(msg.senderId) === Number(currentUserId),
    };
  }

  private async createSystemMessage(
    conversation: Conversation,
    text: string,
    meta?: Record<string, any> | null,
  ) {
    const message = this.messageRepo.create({
      conversationId: String(conversation._id),
      senderId: 0,
      senderName: 'He thong',
      senderFullName: 'He thong',
      senderAvatar: '',
      content: String(text || '').trim(),
      type: 'system',
      mediaUrl: '',
      fileName: '',
      fileSize: 0,
      meta: meta || null,
      createdAt: new Date(),
      isRecalled: false,
      removedForUserIds: [],
    });

    const saved = await this.messageRepo.save(message);

    conversation.lastMessage = {
      text: saved.content,
      content: saved.content,
      senderId: 0,
      createdAt: saved.createdAt,
      type: 'system',
    };
    conversation.lastMessageAt = new Date();
    await this.convRepo.save(conversation);

    emitToConversation(
      String(conversation._id),
      'message:new',
      this.toMessageResponse(saved),
    );
  }

  private async getConversationById(conversationId: string) {
    return this.convRepo.findOne({
      where: { _id: this.toObjectId(conversationId) } as any,
    });
  }

  private async ensureMembership(conversationId: string, userId: number) {
    const conversation = await this.getConversationById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Khong tim thay cuoc tro chuyen');
    }

    const joined = (conversation.members || []).some(
      (item) => Number(item.userId) === Number(userId),
    );
    if (!joined) {
      throw new ForbiddenException('Ban khong thuoc cuoc tro chuyen nay');
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
        avatarUrl: user.avatarUrl || '',
        roleInConversation: 'MEMBER',
      },
      {
        userId: targetUser.userId,
        displayName: targetUser.fullName,
        avatarUrl: targetUser.avatarUrl || '',
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
      avatarUrl: '',
      status: 'active',
      createdAt: new Date(),
      lastMessageAt: new Date(),
      members,
      memberIds,
    });

    const saved = await this.convRepo.save(conv);
    return { conversation: this.toResponse(saved, userId) };
  }

  async createGroup(
    userId: number,
    name: string,
    memberIds: number[],
    avatarUrl?: string,
  ) {
    const normalizedMemberIds = Array.from(
      new Set(
        (memberIds || [])
          .map((id) => Number(id))
          .filter(
            (id) => Number.isFinite(id) && id > 0 && id !== Number(userId),
          ),
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
        avatarUrl: creator.avatarUrl || '',
        roleInConversation: 'OWNER',
      },
      ...members.map((user) => ({
        userId: user.userId,
        displayName: user.fullName,
        avatarUrl: user.avatarUrl || '',
        roleInConversation: 'MEMBER',
      })),
    ];

    const conv = this.convRepo.create({
      type: 'group',
      conversationName: String(name || '').trim(),
      avatarUrl: String(avatarUrl || '').trim(),
      status: 'active',
      createdAt: new Date(),
      lastMessageAt: new Date(),
      members: allMembers as any,
      memberIds: [String(userId), ...normalizedMemberIds.map(String)],
    });

    const saved = await this.convRepo.save(conv);

    await this.createSystemMessage(
      saved,
      `${creator.fullName || 'Nguoi dung'} da tao nhom`,
      { event: 'group_created' },
    );

    await this.notifyUsers(normalizedMemberIds, {
      type: 'group_added',
      title: 'Ban vua duoc them vao nhom',
      content: `${creator.fullName || 'Nguoi dung'} da them ban vao nhom ${saved.conversationName || 'Nhom chat'}`,
      meta: {
        conversationId: String(saved._id),
        conversationName: saved.conversationName || '',
      },
    });

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
      fileName?: string;
      fileSize?: number;
      meta?: Record<string, any> | null;
    },
  ) {
    const conversation = await this.ensureMembership(conversationId, userId);
    await this.ensureDirectMessageAllowed(conversation, userId);

    const user = await this.userService.findOne(userId);
    const normalizedType = String(data.type || '').trim().toLowerCase() || 'text';
    const rawText = String(data.text || '').trim();
    const mediaUrl = String(data.mediaUrl || '').trim();
    const fileName = String(data.fileName || '').trim();
    const fileSize = Number(data.fileSize || 0);
    const meta = data.meta || null;

    const content =
      rawText ||
      (normalizedType === 'image'
        ? '[Anh]'
        : normalizedType === 'file'
          ? `[Tep] ${fileName || 'Tep dinh kem'}`
          : normalizedType === 'share_post'
            ? '[Bai viet chia se]'
            : mediaUrl
              ? '[Tin nhan da phuong tien]'
              : '');

    if (!content) {
      throw new BadRequestException('Tin nhan khong hop le');
    }

    const message = this.messageRepo.create({
      conversationId,
      senderId: userId,
      senderName: user?.fullName || 'Nguoi dung',
      senderFullName: user?.fullName || 'Nguoi dung',
      senderAvatar: user?.avatarUrl || '',
      content,
      type: normalizedType,
      mediaUrl,
      fileName,
      fileSize,
      meta,
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
      type: saved.type,
      mediaUrl: saved.mediaUrl || '',
    };
    conversation.lastMessageAt = new Date();
    await this.convRepo.save(conversation);

    emitToConversation(
      conversationId,
      'message:new',
      this.toMessageResponse(saved, userId),
    );
    emitToUsers(
      this.getConversationMemberIds(conversation),
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
    const conversation = await this.ensureMembership(conversationId, userId);

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
      message.fileName = '';
      message.fileSize = 0;
      message.meta = null;
      const saved = await this.messageRepo.save(message);

      emitToConversation(
        conversationId,
        'message:updated',
        this.toMessageResponse(saved, userId),
      );
      emitToUsers(
        this.getConversationMemberIds(conversation),
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
    emitToUsers([userId], 'message:updated', {
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
    return { message: 'Da cap nhat trang thai da xem' };
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
    return { message: 'Da cap nhat cai dat thong bao' };
  }

  async updateGroupAvatar(
    conversationId: string,
    actorId: number,
    avatarUrl: string,
  ) {
    const conversation = await this.ensureMembership(conversationId, actorId);
    if (conversation.type !== 'group') {
      throw new BadRequestException('Chi ho tro doi avatar cho nhom chat');
    }
    if (!this.isLeaderOrDeputy(conversation, actorId)) {
      throw new ForbiddenException(
        'Chi truong nhom hoac pho nhom moi co quyen doi avatar nhom',
      );
    }

    const normalizedAvatarUrl = String(avatarUrl || '').trim();
    if (!normalizedAvatarUrl) {
      throw new BadRequestException('Avatar URL khong hop le');
    }

    conversation.avatarUrl = normalizedAvatarUrl;
    await this.convRepo.save(conversation);

    const actorMember = this.getMemberByUserId(conversation, actorId);
    const actorName = this.getMemberName(actorMember);

    await this.createSystemMessage(
      conversation,
      `${actorName} da cap nhat anh dai dien nhom`,
      {
        event: 'group_avatar_updated',
        actorId,
      },
    );

    await this.notifyUsers(
      this.getConversationMemberIds(conversation).filter(
        (id) => Number(id) !== Number(actorId),
      ),
      {
        type: 'group_avatar_updated',
        title: 'Avatar nhom da duoc cap nhat',
        content: `${actorName} vua doi avatar nhom ${conversation.conversationName || 'Nhom chat'}`,
        meta: {
          conversationId: String(conversation._id),
          actorId,
        },
      },
    );

    return {
      message: 'Da cap nhat avatar nhom',
      conversation: this.toResponse(conversation, actorId),
    };
  }

  async addMember(conversationId: string, actorId: number, userId: number) {
    const conversation = await this.ensureMembership(conversationId, actorId);
    if (conversation.type !== 'group') {
      throw new BadRequestException('Chi ho tro them thanh vien cho nhom chat');
    }
    if (!this.isLeaderOrDeputy(conversation, actorId)) {
      throw new ForbiddenException(
        'Chi truong nhom hoac pho nhom moi co quyen them thanh vien',
      );
    }

    if (
      (conversation.members || []).some(
        (item) => Number(item.userId) === Number(userId),
      )
    ) {
      return { message: 'Nguoi dung da o trong nhom' };
    }

    const [addedUser, actorUser] = await Promise.all([
      this.userService.findOne(userId),
      this.userService.findOne(actorId),
    ]);
    if (!addedUser) throw new NotFoundException('Nguoi dung khong ton tai');

    conversation.members = [
      ...((conversation.members || []) as any[]),
      {
        userId,
        displayName: addedUser.fullName,
        avatarUrl: addedUser.avatarUrl || '',
        roleInConversation: 'MEMBER',
        notificationsEnabled: true,
        lastReadAt: null,
      },
    ] as any;
    conversation.memberIds = [
      ...new Set([...(conversation.memberIds || []), String(userId)]),
    ];
    await this.convRepo.save(conversation);

    const actorName =
      actorUser?.fullName || this.getMemberName(this.getMemberByUserId(conversation, actorId));

    await this.createSystemMessage(
      conversation,
      `${addedUser.fullName || 'Nguoi dung'} da duoc them vao nhom`,
      {
        event: 'member_added',
        actorId,
        targetUserId: Number(userId),
      },
    );

    await this.notifyUsers([Number(userId)], {
      type: 'group_added',
      title: 'Ban vua duoc them vao nhom',
      content: `${actorName} da them ban vao nhom ${conversation.conversationName || 'Nhom chat'}`,
      meta: {
        conversationId: String(conversation._id),
        actorId,
      },
    });

    return { message: 'Da them thanh vien' };
  }

  async removeMember(
    conversationId: string,
    actorId: number,
    targetUserId: number,
  ) {
    const conversation = await this.ensureMembership(conversationId, actorId);
    if (conversation.type !== 'group') {
      throw new BadRequestException('Chi ho tro xoa thanh vien cho nhom chat');
    }
    if (!this.isLeaderOrDeputy(conversation, actorId)) {
      throw new ForbiddenException(
        'Chi truong nhom hoac pho nhom moi co quyen xoa thanh vien',
      );
    }

    const target = this.getMemberByUserId(conversation, targetUserId);
    if (!target)
      throw new NotFoundException('Thanh vien khong ton tai trong nhom');
    if (Number(targetUserId) === Number(actorId)) {
      throw new BadRequestException(
        'Khong the tu xoa chinh minh khoi nhom bang chuc nang nay',
      );
    }

    const actorRole = this.getMemberRole(
      this.getMemberByUserId(conversation, actorId),
    );
    const targetRole = this.getMemberRole(target);
    if (targetRole === 'leader') {
      throw new BadRequestException('Khong the xoa truong nhom');
    }
    if (targetRole === 'deputy' && actorRole !== 'leader') {
      throw new ForbiddenException('Chi truong nhom moi co the xoa pho nhom');
    }

    const targetName = this.getMemberName(target);

    conversation.members = (conversation.members || []).filter(
      (item) => Number(item.userId) !== Number(targetUserId),
    );
    conversation.memberIds = (conversation.memberIds || []).filter(
      (id) => String(id) !== String(targetUserId),
    );
    await this.convRepo.save(conversation);

    await this.createSystemMessage(
      conversation,
      `${targetName} da bi xoa khoi nhom`,
      {
        event: 'member_removed',
        actorId,
        targetUserId: Number(targetUserId),
      },
    );

    await this.notifyUsers([Number(targetUserId)], {
      type: 'group_removed',
      title: 'Ban da bi xoa khoi nhom',
      content: `Ban da bi xoa khoi nhom ${conversation.conversationName || 'Nhom chat'}`,
      meta: {
        conversationId: String(conversation._id),
        actorId,
      },
    });

    return { message: 'Da xoa thanh vien' };
  }

  async leaveGroup(conversationId: string, actorId: number) {
    const conversation = await this.ensureMembership(conversationId, actorId);
    if (conversation.type !== 'group') {
      throw new BadRequestException('Chi ho tro roi khoi nhom chat');
    }

    const actor = this.getMemberByUserId(conversation, actorId);
    if (!actor) {
      throw new NotFoundException('Thanh vien khong ton tai trong nhom');
    }

    const actorName = this.getMemberName(actor);
    const currentMembers = (conversation.members || []) as MemberLike[];
    const remainingMembers = currentMembers.filter(
      (item) => Number(item.userId) !== Number(actorId),
    );

    if (!remainingMembers.length) {
      await this.convRepo.delete({ _id: this.toObjectId(conversationId) } as any);
      return { message: 'Ban da roi nhom chat' };
    }

    if (this.getMemberRole(actor) === 'leader') {
      const deputy = remainingMembers.find(
        (item) => this.getMemberRole(item) === 'deputy',
      );
      const newLeader = deputy || remainingMembers[0];

      conversation.members = remainingMembers.map((item) => {
        if (Number(item.userId) === Number(newLeader.userId)) {
          return { ...item, roleInConversation: 'OWNER' } as any;
        }
        return item as any;
      }) as any;
    } else {
      conversation.members = remainingMembers as any;
    }

    conversation.memberIds = (conversation.memberIds || []).filter(
      (id) => String(id) !== String(actorId),
    );
    await this.convRepo.save(conversation);

    await this.createSystemMessage(conversation, `${actorName} da roi khoi nhom`, {
      event: 'member_left',
      actorId,
    });

    await this.notifyUsers(this.getConversationMemberIds(conversation), {
      type: 'group_member_left',
      title: 'Thanh vien da roi nhom',
      content: `${actorName} da roi khoi nhom ${conversation.conversationName || 'Nhom chat'}`,
      meta: {
        conversationId: String(conversation._id),
        actorId,
      },
    });

    return { message: 'Ban da roi nhom chat' };
  }

  async transferLeader(
    conversationId: string,
    actorId: number,
    targetUserId: number,
  ) {
    const conversation = await this.ensureMembership(conversationId, actorId);
    if (conversation.type !== 'group') {
      throw new BadRequestException(
        'Chi ho tro chuyen quyen truong nhom cho nhom chat',
      );
    }
    if (!this.isLeader(conversation, actorId)) {
      throw new ForbiddenException(
        'Chi truong nhom moi co quyen chuyen quyen truong nhom',
      );
    }
    if (Number(actorId) === Number(targetUserId)) {
      throw new BadRequestException('Khong the chuyen quyen cho chinh minh');
    }

    const targetMember = this.getMemberByUserId(conversation, targetUserId);
    if (!targetMember) {
      throw new NotFoundException('Thanh vien khong ton tai trong nhom');
    }

    const actorName = this.getMemberName(this.getMemberByUserId(conversation, actorId));
    const targetName = this.getMemberName(targetMember);

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

    await this.createSystemMessage(
      conversation,
      `${actorName} da chuyen quyen truong nhom cho ${targetName}`,
      {
        event: 'leader_transferred',
        actorId,
        targetUserId: Number(targetUserId),
      },
    );

    await this.notifyUsers([Number(targetUserId)], {
      type: 'group_role_changed',
      title: 'Ban da tro thanh truong nhom',
      content: `Ban da tro thanh truong nhom ${conversation.conversationName || 'Nhom chat'}`,
      meta: {
        conversationId: String(conversation._id),
        actorId,
        role: 'leader',
      },
    });

    return { message: 'Da chuyen quyen truong nhom' };
  }

  async setDeputy(
    conversationId: string,
    actorId: number,
    targetUserId: number | null,
  ) {
    const conversation = await this.ensureMembership(conversationId, actorId);
    if (conversation.type !== 'group') {
      throw new BadRequestException('Chi ho tro cap quyen pho nhom cho nhom chat');
    }
    if (!this.isLeader(conversation, actorId)) {
      throw new ForbiddenException('Chi truong nhom moi co quyen cap quyen pho nhom');
    }

    const deputyId = targetUserId ? Number(targetUserId) : null;
    if (deputyId && deputyId === Number(actorId)) {
      throw new BadRequestException('Truong nhom khong the tu dat lam pho nhom');
    }
    if (deputyId && !this.getMemberByUserId(conversation, deputyId)) {
      throw new NotFoundException('Thanh vien khong ton tai trong nhom');
    }

    const previousDeputy = ((conversation.members || []) as MemberLike[]).find(
      (item) => this.getMemberRole(item) === 'deputy',
    );

    conversation.members = ((conversation.members || []) as MemberLike[]).map(
      (item) => {
        const role = this.getMemberRole(item);
        if (role === 'leader') {
          return { ...item, roleInConversation: 'OWNER' } as any;
        }
        if (deputyId && Number(item.userId) === deputyId) {
          return { ...item, roleInConversation: 'deputy' } as any;
        }
        if (role === 'deputy') {
          return { ...item, roleInConversation: 'MEMBER' } as any;
        }
        return item as any;
      },
    );
    await this.convRepo.save(conversation);

    if (deputyId) {
      const deputyMember = this.getMemberByUserId(conversation, deputyId);
      const deputyName = this.getMemberName(deputyMember);
      await this.createSystemMessage(
        conversation,
        `${deputyName} da duoc cap quyen pho nhom`,
        {
          event: 'deputy_assigned',
          actorId,
          targetUserId: deputyId,
        },
      );
      await this.notifyUsers([deputyId], {
        type: 'group_role_changed',
        title: 'Ban da duoc cap quyen pho nhom',
        content: `Ban da duoc cap quyen pho nhom trong ${conversation.conversationName || 'Nhom chat'}`,
        meta: {
          conversationId: String(conversation._id),
          actorId,
          role: 'deputy',
        },
      });
    } else if (previousDeputy) {
      const previousDeputyId = Number(previousDeputy.userId);
      await this.createSystemMessage(
        conversation,
        `${this.getMemberName(previousDeputy)} da bi thu hoi quyen pho nhom`,
        {
          event: 'deputy_removed',
          actorId,
          targetUserId: previousDeputyId,
        },
      );
      await this.notifyUsers([previousDeputyId], {
        type: 'group_role_changed',
        title: 'Quyen pho nhom da bi thu hoi',
        content: `Ban khong con la pho nhom trong ${conversation.conversationName || 'Nhom chat'}`,
        meta: {
          conversationId: String(conversation._id),
          actorId,
          role: 'member',
        },
      });
    }

    return {
      message: deputyId ? 'Da cap quyen pho nhom' : 'Da thu hoi quyen pho nhom',
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
      throw new BadRequestException('Chi ho tro giai tan nhom chat');
    }
    if (!this.isLeader(conversation, actorId)) {
      throw new ForbiddenException('Chi truong nhom moi co quyen giai tan nhom');
    }

    const memberIds = this.getConversationMemberIds(conversation).filter(
      (id) => Number(id) !== Number(actorId),
    );
    const actorName = this.getMemberName(this.getMemberByUserId(conversation, actorId));

    await this.notifyUsers(memberIds, {
      type: 'group_dissolved',
      title: 'Nhom da giai tan',
      content: `${actorName} da giai tan nhom ${conversation.conversationName || 'Nhom chat'}`,
      meta: {
        conversationId: String(conversation._id),
        actorId,
      },
    });

    await this.convRepo.delete({ _id: this.toObjectId(conversationId) } as any);
    return { message: 'Da giai tan nhom chat' };
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
    return { message: 'Da ghim tin nhan' };
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
    return { message: 'Da bo ghim tin nhan' };
  }
}
