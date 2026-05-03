"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerChatSocketHandlers = exports.emitToConversation = exports.getChatSocketServer = exports.setChatSocketServer = void 0;
const jwt = __importStar(require("jsonwebtoken"));
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
const resolveSocketUserId = (socket) => {
    const authUserId = Number(socket.handshake?.auth?.userId || 0);
    if (authUserId > 0)
        return authUserId;
    const authToken = String(socket.handshake?.auth?.token || '').trim();
    const headerToken = String(socket.handshake?.headers?.authorization || '').trim();
    const bearerToken = headerToken.startsWith('Bearer ') ? headerToken.slice(7).trim() : '';
    const token = authToken || bearerToken;
    if (!token)
        return 0;
    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'secretKey');
        return Number(decoded?.id || 0);
    }
    catch (_error) {
        const decoded = jwt.decode(token);
        return Number(decoded?.id || 0);
    }
};
const relayCallEvent = (socket, eventName, payload) => {
    const conversationId = String(payload?.conversationId || '').trim();
    const targetUserId = Number(payload?.targetUserId || 0);
    const senderUserId = resolveSocketUserId(socket);
    const normalizedPayload = {
        ...(payload || {}),
        fromUserId: Number(payload?.fromUserId || 0) || senderUserId || undefined,
    };
    if (targetUserId) {
        socket.to(`user:${targetUserId}`).emit(eventName, normalizedPayload);
        return;
    }
    if (conversationId) {
        socket.to(conversationId).emit(eventName, normalizedPayload);
    }
};
const registerChatSocketHandlers = (server) => {
    server.on('connection', (socket) => {
        const userId = resolveSocketUserId(socket);
        if (userId) {
            socket.join(`user:${userId}`);
        }
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
        socket.on('message:typing', (payload) => {
            const conversationId = String(payload?.conversationId || '').trim();
            const fromUserId = resolveSocketUserId(socket);
            if (conversationId && fromUserId) {
                socket.to(conversationId).emit('message:typing', {
                    conversationId,
                    fromUserId,
                    isTyping: Boolean(payload?.isTyping),
                });
            }
        });
        socket.on('notification:new', (payload) => relayConversationEvent(socket, 'notification:new', payload));
        socket.on('call:offer', (payload) => relayCallEvent(socket, 'call:offer', payload));
        socket.on('call:answer', (payload) => {
            const answeredAt = Number(payload?.answeredAt || 0) || Date.now();
            relayCallEvent(socket, 'call:answer', {
                ...(payload || {}),
                answeredAt,
            });
        });
        socket.on('call:ice-candidate', (payload) => relayCallEvent(socket, 'call:ice-candidate', payload));
        socket.on('call:join', (payload) => relayCallEvent(socket, 'call:join', payload));
        socket.on('call:leave', (payload) => relayCallEvent(socket, 'call:leave', payload));
        socket.on('call:end', (payload) => relayCallEvent(socket, 'call:end', payload));
        socket.on('call:participants', (payload) => {
            const conversationId = String(payload?.conversationId || '').trim();
            if (conversationId) {
                socket.to(conversationId).emit('call:participants', {
                    conversationId,
                    participantCount: Number(payload?.participantCount || 0),
                    participantIds: Array.isArray(payload?.participantIds) ? payload.participantIds : [],
                });
            }
        });
    });
};
exports.registerChatSocketHandlers = registerChatSocketHandlers;
//# sourceMappingURL=chat-socket.js.map