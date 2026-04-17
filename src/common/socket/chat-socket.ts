import { Server, Socket } from 'socket.io';

let chatSocketServer: Server | null = null;

export const setChatSocketServer = (server: Server) => {
	chatSocketServer = server;
};

export const getChatSocketServer = () => chatSocketServer;

export const emitToConversation = (conversationId: string, eventName: string, payload: any) => {
	chatSocketServer?.to(String(conversationId)).emit(eventName, payload);
};

const relayConversationEvent = (socket: Socket, eventName: string, payload: any) => {
	const conversationId = String(payload?.conversationId || '').trim();
	if (!conversationId) return;
	socket.to(conversationId).emit(eventName, payload);
};

export const registerChatSocketHandlers = (server: Server) => {
	server.on('connection', (socket) => {
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
		socket.on('notification:new', (payload) => relayConversationEvent(socket, 'notification:new', payload));
		socket.on('call:offer', (payload) => relayConversationEvent(socket, 'call:offer', payload));
		socket.on('call:answer', (payload) => relayConversationEvent(socket, 'call:answer', payload));
		socket.on('call:ice-candidate', (payload) => relayConversationEvent(socket, 'call:ice-candidate', payload));
		socket.on('call:end', (payload) => relayConversationEvent(socket, 'call:end', payload));
	});
};