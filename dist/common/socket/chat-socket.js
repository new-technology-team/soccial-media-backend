"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerChatSocketHandlers = exports.emitToConversation = exports.getChatSocketServer = exports.setChatSocketServer = void 0;
let chatSocketServer = null;
const setChatSocketServer = (server) => {
    chatSocketServer = server;
};
exports.setChatSocketServer = setChatSocketServer;
const getChatSocketServer = () => chatSocketServer;
exports.getChatSocketServer = getChatSocketServer;
const emitToConversation = (conversationId, eventName, payload) => {
    chatSocketServer?.to(String(conversationId)).emit(eventName, payload);
};
exports.emitToConversation = emitToConversation;
const relayConversationEvent = (socket, eventName, payload) => {
    const conversationId = String(payload?.conversationId || '').trim();
    if (!conversationId)
        return;
    socket.to(conversationId).emit(eventName, payload);
};
const registerChatSocketHandlers = (server) => {
    server.on('connection', (socket) => {
        socket.on('join-conversation', (conversationId) => {
            const roomId = String(conversationId || '').trim();
            if (roomId) {
                socket.join(roomId);
            }
        });
        socket.on('leave-conversation', (conversationId) => {
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
exports.registerChatSocketHandlers = registerChatSocketHandlers;
//# sourceMappingURL=chat-socket.js.map