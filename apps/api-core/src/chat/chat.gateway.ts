import {
  Logger,
  OnModuleInit,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
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

import { AuthService, type SessionRevokedEvent } from '../auth/auth.service';
import { RedisService } from '../redis/redis.service';
import { RoomsService, type RoomCreatedEvent } from '../rooms/rooms.service';
import type { AppConfig } from '../config/configuration';
import { ChatService } from './chat.service';
import {
  CallNoticeDto,
  DeleteMessageDto,
  RoomScopeDto,
  SendMessageDto,
  TypingDto,
  WS_EVENTS,
} from './dto/chat.dto';
import { WsExceptionFilter } from './ws-exception.filter';
import { WsAuthGuard } from './ws-auth.guard';
import { consumeWsBudget, WsThrottle, WsThrottleGuard } from './ws-throttle.guard';

/** Keystroke-rate by nature: the client emits on every change to the input. */
const TYPING_BUDGET = { limit: 60, windowMs: 10_000 };

/** Tabs, devices and a reconnect that has not been reaped yet — all of them. */
const MAX_SOCKETS_PER_USER = 20;

interface AuthedSocket extends Socket {
  /** `exp` is the token's own deadline, re-read on every frame by WsAuthGuard. */
  data: { userId: string; username: string; exp?: number };
}

// CORS is not declared here: RedisIoAdapter creates the server and sets the
// allow-list for every namespace, so a second, looser copy of the rule on this
// decorator would only be a lie about what is enforced.
@WebSocketGateway({ namespace: '/ws' })
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@UseFilters(new WsExceptionFilter())
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
      const event = payload as RoomCreatedEvent | SessionRevokedEvent;

      // Both of these reach across nodes through the Redis adapter, which is
      // the point: the socket they concern is rarely on the node that acted.
      if (event?.type === 'room.created') {
        // Members connected before the room existed are subscribed to it now.
        for (const memberId of event.memberIds) {
          this.server.in(`user:${memberId}`).socketsJoin(`room:${event.roomId}`);
          this.server.to(`user:${memberId}`).emit(WS_EVENTS.roomCreated, { roomId: event.roomId });
        }
        return;
      }

      if (event?.type === 'session.revoked') {
        // Signed out elsewhere: the connection outlives the session unless it
        // is cut here, and it was authenticated once, at connect time.
        this.server.in(`user:${event.userId}`).disconnectSockets(true);
      }
    });
  }

  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = await this.auth.verifyAccessToken(token);
      client.data = { userId: payload.sub, username: payload.username, exp: payload.exp };

      // Every socket joins a personal room (direct notifications) plus all chat rooms.
      await client.join(`user:${payload.sub}`);
      const roomIds = await this.chat.roomIdsOf(payload.sub);
      await Promise.all(roomIds.map((id) => client.join(`room:${id}`)));

      const sockets = await this.redis.markOnline(payload.sub, client.id);
      // A person has a handful of tabs, not fifty. Past that it is a script
      // buying itself extra per-socket rate budget, so the newest one goes.
      if (sockets > MAX_SOCKETS_PER_USER) {
        await this.redis.markOffline(payload.sub, client.id);
        throw new Error(`too many concurrent sockets for user ${payload.sub}`);
      }
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

  @UseGuards(WsAuthGuard, WsThrottleGuard)
  @WsThrottle({ limit: 20, windowMs: 10_000 })
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

  /**
   * The call announcement, posted in the room's voice. It is its own event so
   * that `message:send` can refuse `type: SYSTEM` outright — see CallNoticeDto.
   */
  @UseGuards(WsAuthGuard, WsThrottleGuard)
  @WsThrottle({ limit: 10, windowMs: 10_000 })
  @SubscribeMessage('call:notice')
  async onCallNotice(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() dto: CallNoticeDto,
  ): Promise<{ ok: true; id: string }> {
    const message = await this.chat.postCallNotice(client.data.userId, dto);
    this.server.to(`room:${dto.roomId}`).emit(WS_EVENTS.message, message);
    return { ok: true, id: message.id };
  }

  /**
   * The refusal is answered, not thrown: the client hides the message the
   * moment it is asked to, so it needs a definite "no" to put it back. An
   * exception would only reach the socket's error channel, and the line would
   * stay hidden until the next reload.
   */
  @UseGuards(WsAuthGuard, WsThrottleGuard)
  @WsThrottle({ limit: 30, windowMs: 10_000 })
  @SubscribeMessage('message:delete')
  async onDeleteMessage(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() dto: DeleteMessageDto,
  ): Promise<{ ok: boolean }> {
    try {
      await this.chat.deleteMessage(client.data.userId, dto);
    } catch (err) {
      this.logger.warn(`Delete refused for ${client.data.userId}: ${String(err)}`);
      return { ok: false };
    }

    this.server.to(`room:${dto.roomId}`).emit(WS_EVENTS.messageDeleted, {
      roomId: dto.roomId,
      messageId: dto.messageId,
    });

    return { ok: true };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('presence:typing')
  async onTyping(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() dto: TypingDto,
  ): Promise<void> {
    // Dropped rather than refused: nobody is waiting on the answer, and an
    // error per keystroke would be a louder flood than the one being stopped.
    if (!consumeWsBudget(client, 'presence:typing', TYPING_BUDGET)) return;

    await this.rooms.assertMember(dto.roomId, client.data.userId);
    client.to(`room:${dto.roomId}`).emit(WS_EVENTS.typing, {
      roomId: dto.roomId,
      userId: client.data.userId,
      username: client.data.username,
      isTyping: dto.isTyping,
    });
  }

  @UseGuards(WsAuthGuard, WsThrottleGuard)
  @WsThrottle({ limit: 30, windowMs: 10_000 })
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
