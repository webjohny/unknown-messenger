import { Logger, OnModuleInit, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { AuthService } from '../auth/auth.service';
import { RedisService } from '../redis/redis.service';
import { RoomsService, type RoomCreatedEvent } from '../rooms/rooms.service';
import type { AppConfig } from '../config/configuration';
import { ChatService } from './chat.service';
import { RoomScopeDto, SendMessageDto, TypingDto, WS_EVENTS } from './dto/chat.dto';
import { WsAuthGuard } from './ws-auth.guard';

interface AuthedSocket extends Socket {
  data: { userId: string; username: string };
}

@WebSocketGateway({ namespace: '/ws', cors: { origin: true, credentials: true } })
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly chat: ChatService,
    private readonly rooms: RoomsService,
    private readonly redis: RedisService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    const channel = this.config.get('redis.roomEventsChannel', { infer: true });
    await this.redis.subscribe(channel, (payload) => {
      const event = payload as RoomCreatedEvent;
      if (event?.type !== 'room.created') return;

      // socketsJoin travels through the Redis adapter, so members connected to
      // any node are subscribed to the freshly created room right away.
      for (const memberId of event.memberIds) {
        this.server.in(`user:${memberId}`).socketsJoin(`room:${event.roomId}`);
        this.server.to(`user:${memberId}`).emit(WS_EVENTS.roomCreated, { roomId: event.roomId });
      }
    });
  }

  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = await this.auth.verifyAccessToken(token);
      client.data = { userId: payload.sub, username: payload.username };

      // Every socket joins a personal room (direct notifications) plus all chat rooms.
      await client.join(`user:${payload.sub}`);
      const roomIds = await this.chat.roomIdsOf(payload.sub);
      await Promise.all(roomIds.map((id) => client.join(`room:${id}`)));

      const sockets = await this.redis.markOnline(payload.sub, client.id);
      if (sockets === 1) this.broadcastPresence(payload.sub, true, roomIds);
    } catch (err) {
      this.logger.warn(`Rejected socket ${client.id}: ${String(err)}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthedSocket): Promise<void> {
    const userId = client.data?.userId;
    if (!userId) return;

    const remaining = await this.redis.markOffline(userId, client.id);
    if (remaining === 0) {
      const roomIds = await this.chat.roomIdsOf(userId);
      this.broadcastPresence(userId, false, roomIds);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('message:send')
  async onSendMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() dto: SendMessageDto,
  ): Promise<{ ok: true; id: string; clientId?: string }> {
    const message = await this.chat.persistMessage(client.data.userId, dto);

    this.server.to(`room:${dto.roomId}`).emit(WS_EVENTS.message, {
      ...message,
      clientId: dto.clientId,
    });

    return { ok: true, id: message.id, clientId: dto.clientId };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('presence:typing')
  async onTyping(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() dto: TypingDto,
  ): Promise<void> {
    await this.rooms.assertMember(dto.roomId, client.data.userId);
    client.to(`room:${dto.roomId}`).emit(WS_EVENTS.typing, {
      roomId: dto.roomId,
      userId: client.data.userId,
      username: client.data.username,
      isTyping: dto.isTyping,
    });
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('room:join')
  async onJoinRoom(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() dto: RoomScopeDto,
  ): Promise<{ ok: true }> {
    await this.rooms.assertMember(dto.roomId, client.data.userId);
    await client.join(`room:${dto.roomId}`);
    return { ok: true };
  }

  /** Called by TranscriptsService when the Go service publishes a final transcript. */
  emitToRoom(roomId: string, event: string, payload: unknown): void {
    this.server.to(`room:${roomId}`).emit(event, payload);
  }

  private broadcastPresence(userId: string, online: boolean, roomIds: string[]): void {
    const payload = { userId, online, at: new Date().toISOString() };
    for (const roomId of roomIds) {
      this.server.to(`room:${roomId}`).emit(WS_EVENTS.presence, payload);
    }
  }

  private extractToken(client: Socket): string {
    const fromAuth = (client.handshake.auth as { token?: string } | undefined)?.token;
    const fromHeader = client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
    const token = fromAuth ?? fromHeader;
    if (!token) throw new Error('missing token');
    return token;
  }
}
