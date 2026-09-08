import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { AccessToken, RoomServiceClient, type VideoGrant } from 'livekit-server-sdk';
import { IsNull, Repository } from 'typeorm';

import { CallSession, MemberRole } from '../database/entities';
import { RoomsService } from '../rooms/rooms.service';
import type { AppConfig } from '../config/configuration';
import type { AuthUser } from '../auth/jwt.strategy';
import type { JoinRoomDto, JoinRoomResponse } from './dto/livekit.dto';

/**
 * LiveKit answers "no such room" as a Twirp `not_found`, which the SDK surfaces
 * as a plain error — there is no typed class to instanceof against, so the
 * message is what there is to read.
 */
function isRoomMissing(err: unknown): boolean {
  return /not_found|does not exist/i.test(String((err as { message?: string })?.message ?? err));
}

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private readonly roomClient: RoomServiceClient;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly rooms: RoomsService,
    @InjectRepository(CallSession) private readonly sessions: Repository<CallSession>,
  ) {
    const lk = this.config.get('livekit', { infer: true });
    this.roomClient = new RoomServiceClient(lk.httpUrl, lk.apiKey, lk.apiSecret);
  }

  async createJoinToken(user: AuthUser, dto: JoinRoomDto): Promise<JoinRoomResponse> {
    const { room, membership } = await this.rooms.assertMember(dto.roomId, user.id);
    const lk = this.config.get('livekit', { infer: true });

    await this.ensureRoomExists(room.name);
    const session = await this.ensureCallSession(room.id, room.name);

    const canPublish = !dto.viewerOnly;
    const grant: VideoGrant = {
      room: room.name,
      roomJoin: true,
      canPublish,
      canPublishData: true,
      canSubscribe: true,
      // Only moderators may kick participants or mute other tracks.
      roomAdmin: membership.role !== MemberRole.MEMBER,
    };

    const at = new AccessToken(lk.apiKey, lk.apiSecret, {
      identity: user.id,
      name: user.displayName,
      ttl: '2h',
      metadata: JSON.stringify({ username: user.username, avatarUrl: user.avatarUrl }),
    });
    at.addGrant(grant);

    return {
      token: await at.toJwt(),
      url: lk.wsUrl,
      roomName: room.name,
      identity: user.id,
      callSessionId: session.id,
    };
  }

  /** Short-lived admin token handed to the Go transcription bot. */
  async createBotToken(roomName: string, identity: string): Promise<string> {
    const lk = this.config.get('livekit', { infer: true });
    const at = new AccessToken(lk.apiKey, lk.apiSecret, { identity, ttl: '6h' });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canSubscribe: true,
      canPublish: false,
      canPublishData: true,
      hidden: true,
    });
    return at.toJwt();
  }

  /** Who is on the call — readable by the members of that room and nobody else. */
  async listParticipants(user: AuthUser, roomName: string) {
    await this.rooms.assertMemberByName(roomName, user.id);
    try {
      return await this.roomClient.listParticipants(roomName);
    } catch (err) {
      // `auto_create` is off, so a room the SFU has never heard of is simply a
      // room with no call in it — an empty list, not a failure.
      if (isRoomMissing(err)) return [];
      throw err;
    }
  }

  /**
   * Throwing someone off a call is the moderator action the LiveKit grant calls
   * `roomAdmin` (see createJoinToken), so it is gated the same way — otherwise
   * this endpoint would hand every member the power the token withholds.
   */
  async removeParticipant(user: AuthUser, roomName: string, identity: string): Promise<void> {
    const { membership } = await this.rooms.assertMemberByName(roomName, user.id);
    if (membership.role === MemberRole.MEMBER) {
      throw new ForbiddenException('Only a room moderator may remove participants');
    }
    try {
      await this.roomClient.removeParticipant(roomName, identity);
    } catch (err) {
      if (isRoomMissing(err)) throw new NotFoundException('No call is running in this room');
      throw err;
    }
  }

  /**
   * Closes the call record. Any member may do it: the client calls this on its
   * own hang-up, and the last person to leave is usually not the owner.
   */
  async endCallSession(user: AuthUser, roomName: string): Promise<void> {
    await this.rooms.assertMemberByName(roomName, user.id);
    await this.sessions.update(
      { livekitRoom: roomName, endedAt: IsNull() },
      { endedAt: new Date() },
    );
  }

  private async ensureRoomExists(name: string): Promise<void> {
    try {
      await this.roomClient.createRoom({ name, emptyTimeout: 300, maxParticipants: 100 });
    } catch (err) {
      // createRoom is idempotent in practice; an existing room is not an error.
      this.logger.debug(`createRoom(${name}) skipped: ${String(err)}`);
    }
  }

  private async ensureCallSession(roomId: string, livekitRoom: string): Promise<CallSession> {
    const active = await this.sessions.findOne({
      where: { roomId, endedAt: IsNull() },
      order: { startedAt: 'DESC' },
    });
    if (active) return active;

    return this.sessions.save(this.sessions.create({ roomId, livekitRoom }));
  }
}
