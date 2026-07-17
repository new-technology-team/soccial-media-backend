import { ObjectId } from 'mongodb';
import { BadRequestException } from '@nestjs/common';
import { Conversation } from './conversation.entity';
import { Message } from '../message/message.entity';
import { MemberLike } from './conversation.types';

export function toObjectId(value: string) {
  if (!ObjectId.isValid(value)) {
    throw new BadRequestException('Conversation id khong hop le');
  }
  return new ObjectId(value);
}

export function normalizeRole(role: unknown) {
  const value = String(role || '').toLowerCase();
  if (['owner', 'leader', 'admin'].includes(value)) return 'leader';
  if (value === 'deputy') return 'deputy';
  return 'member';
}

export function getMemberRole(member?: MemberLike) {
  return normalizeRole(member?.role ?? member?.roleInConversation);
}

export function getMemberByUserId(conversation: Conversation, userId: number) {
  return ((conversation.members || []) as MemberLike[]).find(
    (item) => Number(item.userId) === Number(userId),
  );
}

export function getMemberName(member?: MemberLike, fallback = 'Nguoi dung') {
  return String(member?.displayName || member?.fullName || fallback);
}

export function isLeader(conversation: Conversation, userId: number) {
  return (
    getMemberRole(getMemberByUserId(conversation, userId)) === 'leader'
  );
}

export function isLeaderOrDeputy(conversation: Conversation, userId: number) {
  const role = getMemberRole(getMemberByUserId(conversation, userId));
  return role === 'leader' || role === 'deputy';
}

export function getConversationMemberIds(conversation: Conversation) {
  return ((conversation.members || []) as MemberLike[])
    .map((member) => Number(member.userId))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export function toConversationResponse(conv: Conversation, currentUserId?: number) {
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
      fullName: getMemberName(member),
      username: member.username || '',
      avatarUrl: member.avatarUrl || null,
      role: getMemberRole(member),
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

export function getDirectPeerUserId(conversation: Conversation, userId: number) {
  const members = (conversation.members || []) as MemberLike[];
  const normalizedType = String(conversation.type || '').toLowerCase();
  if (normalizedType === 'group' || members.length > 2) return null;
  const peer = members.find(
    (member) => Number(member.userId) !== Number(userId),
  );
  return peer ? Number(peer.userId) : null;
}

export function toMessageResponse(msg: Message, currentUserId?: number) {
  const recalledText = 'Tin nhan da duoc thu hoi';
  const reactions = msg.reactions || [];
  const viewerReaction =
    currentUserId !== undefined
      ? (reactions.find((r) => Number(r.userId) === Number(currentUserId))?.reaction ?? null)
      : null;
  return {
    id: String(msg._id),
    conversationId: msg.conversationId,
    senderId: Number(msg.senderId || 0),
    senderName: msg.senderName || msg.senderFullName || 'Nguoi dung',
    senderUsername: msg.senderUsername || '',
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
    reactionCount: reactions.length,
    viewerReaction,
    reactions: reactions.map((r) => ({
      userId: Number(r.userId),
      reaction: r.reaction,
      createdAt: r.createdAt || null,
    })),
    createdAt: msg.createdAt?.toISOString?.() ?? new Date().toISOString(),
    isMine: Number(msg.senderId) === Number(currentUserId),
  };
}
