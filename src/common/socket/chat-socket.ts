import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

let chatSocketServer: Server | null = null;
const onlineSocketsByUser = new Map<number, Set<string>>();
const lastActiveByUser = new Map<number, Date>();

type ActiveCallInfo = {
	conversationId: string;
	mode: 'private' | 'group';
	peerIds: Set<number>;
};
const activeCallByUser = new Map<number, ActiveCallInfo>();
type ActiveCallRoom = {
	conversationId: string;
	mode: 'private' | 'group';
	callType: 'voice' | 'video';
	initiatorId?: number;
	participants: Map<number, { userId: number; joinedAt: number; micMuted?: boolean; cameraOff?: boolean }>;
	createdAt: number;
	updatedAt: number;
};
const activeCallRooms = new Map<string, ActiveCallRoom>();

export const setChatSocketServer = (server: Server) => {
	chatSocketServer = server;
};

export const getChatSocketServer = () => chatSocketServer;

export const emitToConversation = (conversationId: string, eventName: string, payload: any) => {
	chatSocketServer?.to(String(conversationId)).emit(eventName, payload);
};

export const emitToUser = (userId: number, eventName: string, payload: any) => {
	chatSocketServer?.to(`user:${Number(userId)}`).emit(eventName, payload);
};

export const emitSocialEvent = (eventName: string, payload: any) => {
	chatSocketServer?.emit(eventName, payload);
};

export const isChatUserOnline = (userId: number) => Boolean(onlineSocketsByUser.get(Number(userId))?.size);

export const getChatUserLastActiveAt = (userId: number) => lastActiveByUser.get(Number(userId)) || null;

const broadcastPresence = (userId: number, online: boolean) => {
	chatSocketServer?.emit('presence:updated', {
		userId,
		online,
		lastActiveAt: (getChatUserLastActiveAt(userId) || new Date()).toISOString(),
	});
};

const getPresencePayload = (userId: number) => ({
	userId,
	online: isChatUserOnline(userId),
	lastActiveAt: (getChatUserLastActiveAt(userId) || new Date()).toISOString(),
});

const relayConversationEvent = (socket: Socket, eventName: string, payload: any) => {
	const conversationId = String(payload?.conversationId || '').trim();
	if (!conversationId) return;
	socket.to(conversationId).emit(eventName, payload);
};

const relayTypingEvent = (socket: Socket, payload: any, isTyping: boolean) => {
	const conversationId = String(payload?.conversationId || '').trim();
	const fromUserId = resolveSocketUserId(socket);
	if (conversationId && fromUserId) {
		socket.to(conversationId).emit('message:typing', {
			conversationId,
			fromUserId,
			isTyping,
		});
		socket.to(conversationId).emit(isTyping ? 'typing' : 'stopTyping', {
			conversationId,
			fromUserId,
		});
	}
};

const resolveSocketUserId = (socket: Socket) => {
	const authUserId = Number(socket.handshake?.auth?.userId || 0);
	if (authUserId > 0) return authUserId;

	const authToken = String(socket.handshake?.auth?.token || '').trim();
	const headerToken = String(socket.handshake?.headers?.authorization || '').trim();
	const bearerToken = headerToken.startsWith('Bearer ') ? headerToken.slice(7).trim() : '';
	const token = authToken || bearerToken;
	if (!token) return 0;

	try {
		const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'secretKey') as { id?: number | string };
		return Number(decoded?.id || 0);
	} catch (_error) {
		return 0;
	}
};

const trackCallParticipation = (userId: number, payload: any) => {
	const conversationId = String(payload?.conversationId || '').trim();
	if (!userId || !conversationId) return;
	const mode: 'private' | 'group' = payload?.mode === 'group' ? 'group' : 'private';
	const existing = activeCallByUser.get(userId);
	const peerIds = existing?.peerIds || new Set<number>();
	const targetUserId = Number(payload?.targetUserId || 0);
	if (targetUserId) peerIds.add(targetUserId);
	const fromUserId = Number(payload?.fromUserId || 0);
	if (fromUserId) peerIds.add(fromUserId);
	activeCallByUser.set(userId, { conversationId, mode: existing?.mode || mode, peerIds });
};

const getOrCreateCallRoom = (conversationId: string, payload: any, userId?: number) => {
	const mode: 'private' | 'group' = payload?.mode === 'group' ? 'group' : 'private';
	const callType: 'voice' | 'video' = payload?.callType === 'video' ? 'video' : 'voice';
	const existing = activeCallRooms.get(conversationId);
	if (existing) {
		existing.mode = existing.mode === 'group' || mode === 'group' ? 'group' : 'private';
		if (payload?.callType) existing.callType = callType;
		existing.updatedAt = Date.now();
		return existing;
	}
	const room: ActiveCallRoom = {
		conversationId,
		mode,
		callType,
		initiatorId: Number(payload?.initiatorId || payload?.fromUserId || userId || 0) || undefined,
		participants: new Map(),
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
	activeCallRooms.set(conversationId, room);
	return room;
};

const serializeCallRoom = (room: ActiveCallRoom) => ({
	conversationId: room.conversationId,
	mode: room.mode,
	callType: room.callType,
	initiatorId: room.initiatorId,
	participantCount: room.participants.size,
	participantIds: [...room.participants.keys()],
	participants: [...room.participants.values()],
});

const joinActiveCallRoom = (socket: Socket, payload: any) => {
	const userId = resolveSocketUserId(socket);
	const conversationId = String(payload?.conversationId || '').trim();
	if (!userId || !conversationId) return;
	socket.join(conversationId);
	const room = getOrCreateCallRoom(conversationId, payload, userId);
	const existing = room.participants.get(userId);
	room.participants.set(userId, {
		userId,
		joinedAt: existing?.joinedAt || Date.now(),
		micMuted: Boolean(payload?.micMuted ?? existing?.micMuted ?? false),
		cameraOff: Boolean(payload?.cameraOff ?? existing?.cameraOff ?? payload?.callType !== 'video'),
	});
	room.updatedAt = Date.now();
	trackCallParticipation(userId, { ...payload, conversationId, mode: room.mode });
	socket.emit('call:participants', serializeCallRoom(room));
	socket.to(conversationId).emit('call:participants', serializeCallRoom(room));
};

const leaveActiveCallRoom = (userId: number, conversationId?: string) => {
	const targetConversationId = conversationId || activeCallByUser.get(userId)?.conversationId;
	clearCallParticipation(userId, false);
	if (!targetConversationId) return null;
	const room = activeCallRooms.get(targetConversationId);
	if (!room) return null;
	room.participants.delete(userId);
	room.updatedAt = Date.now();
	if (room.participants.size === 0) {
		activeCallRooms.delete(targetConversationId);
		return null;
	}
	return room;
};

const clearCallParticipation = (userId: number, clearRoom = true) => {
	if (clearRoom) leaveActiveCallRoom(userId);
	activeCallByUser.delete(userId);
};

const relayCallEvent = (socket: Socket, eventName: string, payload: any) => {
	const conversationId = String(payload?.conversationId || '').trim();
	const targetUserId = Number(payload?.targetUserId || 0);
	const senderUserId = resolveSocketUserId(socket);
	const normalizedPayload = {
		...(payload || {}),
		fromUserId: Number(payload?.fromUserId || 0) || senderUserId || undefined,
	};

	if (targetUserId) {
		// Khi bắt đầu cuộc gọi tới người offline → báo lại cho người gọi thay vì gửi vào hư không.
		if (eventName === 'call:offer' && !isChatUserOnline(targetUserId)) {
			socket.emit('call:unavailable', {
				targetUserId,
				conversationId,
				reason: 'offline',
			});
			return;
		}
		socket.to(`user:${targetUserId}`).emit(eventName, normalizedPayload);
		return;
	}

	if (conversationId) {
		// Membership guard nhẹ: chỉ relay nếu người gửi đang ở trong room hội thoại.
		if (!socket.rooms.has(conversationId)) return;
		socket.to(conversationId).emit(eventName, normalizedPayload);
	}
};

export const registerChatSocketHandlers = (server: Server) => {
	server.on('connection', (socket) => {
		const userId = resolveSocketUserId(socket);
		if (userId) {
			socket.join(`user:${userId}`);
			const sockets = onlineSocketsByUser.get(userId) || new Set<string>();
			sockets.add(socket.id);
			onlineSocketsByUser.set(userId, sockets);
			lastActiveByUser.set(userId, new Date());
			broadcastPresence(userId, true);
		}

		socket.on('join-conversation', (conversationId: string) => {
			const roomId = String(conversationId || '').trim();
			if (roomId) {
				socket.join(roomId);
			}
		});

		socket.on('leave-conversation', (conversationId: string) => {
			const roomId = String(conversationId || '').trim();
			if (roomId) {
				socket.leave(roomId);
			}
		});

		socket.on('message:new', (payload) => relayConversationEvent(socket, 'message:new', payload));
		socket.on('message:reaction', (payload) => relayConversationEvent(socket, 'message:reaction', payload));
		socket.on('message:updated', (payload) => relayConversationEvent(socket, 'message:updated', payload));
		socket.on('message:typing', (payload) => relayTypingEvent(socket, payload, Boolean(payload?.isTyping)));
		socket.on('typing', (payload) => relayTypingEvent(socket, payload, true));
		socket.on('stopTyping', (payload) => relayTypingEvent(socket, payload, false));
		socket.on('notification:new', (payload) => relayConversationEvent(socket, 'notification:new', payload));
			socket.on('presence:check', (payload, ack) => {
				const targetUserId = Number(payload?.userId || 0);
				if (typeof ack === 'function') {
					ack(targetUserId ? getPresencePayload(targetUserId) : { userId: 0, online: false, lastActiveAt: new Date().toISOString() });
				}
			});
		socket.on('call:offer', (payload) => relayCallEvent(socket, 'call:offer', payload));
		socket.on('call:answer', (payload) => {
			// Luôn dùng thời gian của server để tính thời lượng cuộc gọi chính xác.
			relayCallEvent(socket, 'call:answer', {
				...(payload || {}),
				answeredAt: Date.now(),
			});
		});
		socket.on('call:ice-candidate', (payload) => relayCallEvent(socket, 'call:ice-candidate', payload));
		socket.on('call:reject', (payload) => relayCallEvent(socket, 'call:reject', payload));
		socket.on('call:join', (payload) => {
			if (userId) joinActiveCallRoom(socket, payload);
			relayCallEvent(socket, 'call:join', payload);
		});
		socket.on('call:leave', (payload) => {
			if (userId) {
				const room = leaveActiveCallRoom(userId, String(payload?.conversationId || '').trim());
				if (room) socket.to(room.conversationId).emit('call:participants', serializeCallRoom(room));
			}
			relayCallEvent(socket, 'call:leave', payload);
				relayCallEvent(socket, 'call:left', payload);
		});
		socket.on('call:end', (payload) => {
			if (userId) clearCallParticipation(userId);
			relayCallEvent(socket, 'call:end', payload);
				relayCallEvent(socket, 'call:ended', payload);
		});
		socket.on('call_started', (payload) => {
			if (userId) joinActiveCallRoom(socket, { ...payload, mode: 'private' });
			relayCallEvent(socket, 'call_started', payload);
		});
		socket.on('call_joined', (payload) => {
			if (userId) joinActiveCallRoom(socket, { ...payload, mode: 'private' });
			relayCallEvent(socket, 'call_joined', payload);
		});
		socket.on('call_ended', (payload) => relayCallEvent(socket, 'call_ended', payload));
		socket.on('group_call_started', (payload) => {
			if (userId) joinActiveCallRoom(socket, { ...payload, mode: 'group' });
			relayCallEvent(socket, 'group_call_started', payload);
		});
		socket.on('group_call_joined', (payload) => {
			if (userId) joinActiveCallRoom(socket, { ...payload, mode: 'group' });
			relayCallEvent(socket, 'group_call_joined', payload);
		});
		socket.on('group_call_left', (payload) => {
			if (userId) {
				const room = leaveActiveCallRoom(userId, String(payload?.conversationId || '').trim());
				if (room) socket.to(room.conversationId).emit('call:participants', serializeCallRoom(room));
			}
			relayCallEvent(socket, 'group_call_left', payload);
				relayCallEvent(socket, 'call:left', payload);
		});
		socket.on('group_call_ended', (payload) => {
			const conversationId = String(payload?.conversationId || '').trim();
			if (conversationId) activeCallRooms.delete(conversationId);
			if (userId) clearCallParticipation(userId, false);
			relayCallEvent(socket, 'group_call_ended', payload);
				relayCallEvent(socket, 'call:ended', payload);
		});
		socket.on('participant_updated', (payload) => {
			const conversationId = String(payload?.conversationId || '').trim();
			if (conversationId && userId) {
				const room = activeCallRooms.get(conversationId);
				const participant = room?.participants.get(userId);
				if (room && participant) {
					room.participants.set(userId, { ...participant, ...payload, userId });
					room.updatedAt = Date.now();
					socket.to(conversationId).emit('call:participants', serializeCallRoom(room));
				}
			}
			relayCallEvent(socket, 'participant_updated', payload);
		});
		socket.on('participant_muted', (payload) => {
			const conversationId = String(payload?.conversationId || '').trim();
			if (conversationId && userId) {
				const room = activeCallRooms.get(conversationId);
				const participant = room?.participants.get(userId);
				if (room && participant) {
					room.participants.set(userId, { ...participant, micMuted: payload?.micMuted !== false });
					room.updatedAt = Date.now();
				}
			}
			relayCallEvent(socket, 'participant_muted', payload);
		});
		socket.on('participant_camera_off', (payload) => {
			const conversationId = String(payload?.conversationId || '').trim();
			if (conversationId && userId) {
				const room = activeCallRooms.get(conversationId);
				const participant = room?.participants.get(userId);
				if (room && participant) {
					room.participants.set(userId, { ...participant, cameraOff: true });
					room.updatedAt = Date.now();
				}
			}
			relayCallEvent(socket, 'participant_camera_off', payload);
		});
		socket.on('participant_camera_on', (payload) => {
			const conversationId = String(payload?.conversationId || '').trim();
			if (conversationId && userId) {
				const room = activeCallRooms.get(conversationId);
				const participant = room?.participants.get(userId);
				if (room && participant) {
					room.participants.set(userId, { ...participant, cameraOff: false });
					room.updatedAt = Date.now();
				}
			}
			relayCallEvent(socket, 'participant_camera_on', payload);
		});
		socket.on('participant_speaking', (payload) => relayCallEvent(socket, 'participant_speaking', payload));
		socket.on('call:participants', (payload) => {
			const conversationId = String(payload?.conversationId || '').trim();
			if (conversationId) {
				const room = activeCallRooms.get(conversationId);
				socket.to(conversationId).emit('call:participants', room ? serializeCallRoom(room) : {
					conversationId,
					participantCount: Number(payload?.participantCount || 0),
					participantIds: Array.isArray(payload?.participantIds) ? payload.participantIds : [],
				});
			}
		});

		socket.on('disconnect', () => {
			if (!userId) return;
			const sockets = onlineSocketsByUser.get(userId);
			sockets?.delete(socket.id);
			lastActiveByUser.set(userId, new Date());
			if (!sockets?.size) {
				onlineSocketsByUser.delete(userId);
				broadcastPresence(userId, false);
				// Nếu user đang trong cuộc gọi và rớt kết nối hẳn → báo cho các bên còn lại để tránh kẹt.
				const call = activeCallByUser.get(userId);
				if (call) {
					const payload = {
						conversationId: call.conversationId,
						fromUserId: userId,
						userId,
						reason: 'disconnected',
					};
					if (call.mode === 'group') {
						const room = leaveActiveCallRoom(userId, call.conversationId);
						emitToConversation(call.conversationId, 'group_call_left', payload);
						emitToConversation(call.conversationId, 'call:left', payload);
						if (room) emitToConversation(call.conversationId, 'call:participants', serializeCallRoom(room));
					} else {
						emitToConversation(call.conversationId, 'call:end', payload);
						emitToConversation(call.conversationId, 'call:ended', payload);
						call.peerIds.forEach((peerId) => emitToUser(peerId, 'call:end', payload));
						call.peerIds.forEach((peerId) => emitToUser(peerId, 'call:ended', payload));
						leaveActiveCallRoom(userId, call.conversationId);
					}
					clearCallParticipation(userId);
				}
			}
		});
	});
};
