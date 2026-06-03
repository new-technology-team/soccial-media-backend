import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

let chatSocketServer: Server | null = null;

const resolveJwtSecret = () =>
  process.env.JWT_ACCESS_SECRET ||
  'secretKey';

export const setChatSocketServer = (server: Server) => {
  chatSocketServer = server;
};

export const getChatSocketServer = (): Server | null => chatSocketServer;

export const emitToConversation = (
  conversationId: string,
  eventName: string,
  payload: any,
) => {
  if (chatSocketServer) {
    chatSocketServer.to(String(conversationId)).emit(eventName, payload);
  }
};

export const emitToUser = (userId: number, eventName: string, payload: any) => {
  if (!chatSocketServer) return;
  const normalizedUserId = Number(userId || 0);
  if (!normalizedUserId) return;
  chatSocketServer.to(`user:${normalizedUserId}`).emit(eventName, payload);
};

export const emitToUsers = (
  userIds: Array<number | string>,
  eventName: string,
  payload: any,
) => {
  const uniqueIds = Array.from(
    new Set((userIds || []).map((value) => Number(value || 0)).filter(Boolean)),
  );
  uniqueIds.forEach((userId) => emitToUser(userId, eventName, payload));
};

export const relayConversationEvent = (
  socket: {
    to: (roomId: string) => { emit: (eventName: string, payload: any) => void };
  },
  eventName: string,
  payload: any,
) => {
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
  const headerToken = String(
    socket.handshake?.headers?.authorization || '',
  ).trim();
  const bearerToken = headerToken.startsWith('Bearer ')
    ? headerToken.slice(7).trim()
    : '';
  const token = authToken || bearerToken;
  if (!token) return 0;

  try {
    const decoded = jwt.verify(token, resolveJwtSecret()) as {
      id?: number | string;
      sub?: number | string;
      userId?: number | string;
    };
    return Number(decoded?.id || decoded?.sub || decoded?.userId || 0);
  } catch (_error) {
    const decoded = jwt.decode(token) as
      | { id?: number | string; sub?: number | string; userId?: number | string }
      | null;
    return Number(decoded?.id || decoded?.sub || decoded?.userId || 0);
  }
};

const relayCallEvent = (socket: Socket, eventName: string, payload: any) => {
  const conversationId = String(payload?.conversationId || '').trim();
  const targetUserId = Number(payload?.targetUserId || 0);
  const senderUserId = resolveSocketUserId(socket);
  const normalizedPayload = {
    ...(payload || {}),
    fromUserId: Number(payload?.fromUserId || 0) || senderUserId || undefined,
  };

  if (targetUserId && conversationId) {
    socket
      .to(`user:${targetUserId}`)
      .to(conversationId)
      .emit(eventName, normalizedPayload);
    return;
  }

  if (targetUserId) {
    socket.to(`user:${targetUserId}`).emit(eventName, normalizedPayload);
    return;
  }

  if (conversationId) {
    socket.to(conversationId).emit(eventName, normalizedPayload);
  }
};

export const registerChatSocketHandlers = (server: Server) => {
  server.on('connection', (socket) => {
    const userId = resolveSocketUserId(socket);
    if (userId) {
      socket.join(`user:${userId}`);
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

    socket.on('message:new', (payload) =>
      relayConversationEvent(socket, 'message:new', payload),
    );
    socket.on('message:reaction', (payload) =>
      relayConversationEvent(socket, 'message:reaction', payload),
    );
    socket.on('message:updated', (payload) =>
      relayConversationEvent(socket, 'message:updated', payload),
    );
    socket.on('notification:new', (payload) =>
      relayConversationEvent(socket, 'notification:new', payload),
    );
    socket.on('call:offer', (payload) =>
      relayCallEvent(socket, 'call:offer', payload),
    );
    socket.on('call:answer', (payload) => {
      const answeredAt = Number(payload?.answeredAt || 0) || Date.now();
      relayCallEvent(socket, 'call:answer', {
        ...(payload || {}),
        answeredAt,
      });
    });
    socket.on('call:ice-candidate', (payload) =>
      relayCallEvent(socket, 'call:ice-candidate', payload),
    );
    socket.on('call:join', (payload) =>
      relayCallEvent(socket, 'call:join', payload),
    );
    socket.on('call:leave', (payload) =>
      relayCallEvent(socket, 'call:leave', payload),
    );
    socket.on('call:end', (payload) =>
      relayCallEvent(socket, 'call:end', payload),
    );
  });
};
