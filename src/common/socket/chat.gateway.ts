import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  setChatSocketServer,
  emitToConversation,
  registerChatSocketHandlers,
} from './chat-socket';
import { JwtService } from '@nestjs/jwt';

const resolveJwtSecret = () =>
  process.env.JWT_ACCESS_SECRET ||
  'secretKey';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    setChatSocketServer(server);
    registerChatSocketHandlers(server);
    void server;
  }

  async handleConnection(client: Socket) {
    const token =
      client.handshake?.auth?.token ||
      client.handshake?.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: resolveJwtSecret(),
      });
      const userId = Number(payload?.sub || payload?.id || payload?.userId || 0);
      if (!userId) {
        client.disconnect(true);
        return;
      }
      client.data.userId = userId;
      client.data.username = payload.username;
      client.join(`user:${userId}`);
      client.join('global-feed');
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    void client;
  }

  @SubscribeMessage('join-conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    const roomId = String(conversationId || '').trim();
    if (roomId) {
      client.join(roomId);
    }
  }

  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    const roomId = String(conversationId || '').trim();
    if (roomId) {
      client.leave(roomId);
    }
  }

  @SubscribeMessage('message:new')
  handleMessageNew(@MessageBody() payload: any) {
    const conversationId = String(payload?.conversationId || '').trim();
    if (conversationId) {
      emitToConversation(conversationId, 'message:new', payload);
    }
    // Also emit to global feed
    emitToConversation('global-feed', 'message:new', payload);
  }

  @SubscribeMessage('post:new')
  handlePostNew(@MessageBody() payload: any) {
    emitToConversation('global-feed', 'post:new', payload);
  }

  @SubscribeMessage('comment:new')
  handleCommentNew(@MessageBody() payload: any) {
    const postId = payload?.postId;
    if (postId) {
      emitToConversation(`post-${postId}`, 'comment:new', payload);
    }
    emitToConversation('global-feed', 'comment:new', payload);
  }

  @SubscribeMessage('notification:new')
  handleNotificationNew(@MessageBody() payload: any) {
    const userId = payload?.userId;
    if (userId) {
      emitToConversation(`user:${userId}`, 'notification:new', payload);
    }
  }

  @SubscribeMessage('join-feed')
  handleJoinFeed(@ConnectedSocket() client: Socket) {
    client.join('global-feed');
  }

  @SubscribeMessage('leave-feed')
  handleLeaveFeed(@ConnectedSocket() client: Socket) {
    client.leave('global-feed');
  }
}
