import { Server } from 'socket.io';
export declare const setChatSocketServer: (server: Server) => void;
export declare const getChatSocketServer: () => any;
export declare const emitToConversation: (conversationId: string, eventName: string, payload: any) => void;
export declare const registerChatSocketHandlers: (server: Server) => void;
//# sourceMappingURL=chat-socket.d.ts.map