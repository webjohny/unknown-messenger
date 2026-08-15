import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';

import { AuthService } from '../auth/auth.service';
import type { AuthTokens } from '../auth/dto/auth.dto';
import type { AuthUser } from '../auth/jwt.strategy';
import { ChatGateway } from '../chat/chat.gateway';
import { WS_EVENTS } from '../chat/dto/chat.dto';
import type { AppConfig } from '../config/configuration';
import {
  Invite,
  MemberRole,
  Message,
  MessageType,
  Room,
  RoomMember,
  RoomType,
  User,
} from '../database/entities';
import { RoomsService } from '../rooms/rooms.service';
import type { CreatedInvite, CreateInviteDto, InvitePreview, InviteSession } from './dto/invites.dto';

const DEFAULT_TITLE = 'Анонімний чат';

/** 9 bytes of base64url — 72 bits, short enough to paste into a message. */
const TOKEN_BYTES = 9;

type Actor = Pick<User, 'id' | 'username' | 'displayName' | 'isGuest'>;

interface ResolvedActor {
  user: Actor;
  /** Non-null only when a guest was created to serve this request. */
  tokens: AuthTokens | null;
}

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(Invite) private readonly invites: Repository<Invite>,
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(RoomMember) private readonly members: Repository<RoomMember>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly dataSource: DataSource,
    private readonly auth: AuthService,
    private readonly roomsService: RoomsService,
    private readonly gateway: ChatGateway,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Creates the room and the link that is its only address, in that order. The
   * caller may be nobody at all — that is the point of the feature — in which
   * case a guest identity is minted here and handed back with the room.
   */
  async create(actor: AuthUser | null, dto: CreateInviteDto): Promise<CreatedInvite> {
    const { user, tokens } = await this.resolveActor(actor);

    const token = randomBytes(TOKEN_BYTES).toString('base64url');

    const { room } = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(Room, {
          name: `anon_${randomUUID()}`,
          title: dto.title ?? DEFAULT_TITLE,
          type: RoomType.ANON,
        }),
      );

      await manager.save(
        manager.create(RoomMember, {
          roomId: created.id,
          userId: user.id,
          role: MemberRole.OWNER,
        }),
      );

      await manager.save(
        manager.create(Invite, {
          token,
          roomId: created.id,
          createdById: user.id,
          maxUses: dto.maxUses ?? null,
          expiresAt: dto.expiresInHours
            ? new Date(Date.now() + dto.expiresInHours * 3_600_000)
            : null,
        }),
      );

      return {
        room: await manager.findOneOrFail(Room, {
          where: { id: created.id },
          relations: { members: { user: true } },
        }),
      };
    });

    await this.roomsService.announceRoom(room.id, [user.id]);

    const url = this.urlFor(token);
    // The link lives in the thread, so it survives a reload and a device
    // change: there is no chat list entry to find this room by.
    await this.postSystemMessage(
      room.id,
      user.id,
      `Це анонімна кімната. Надішли друзям посилання, щоб вони приєдналися: ${url}`,
    );

    return { token, url, roomId: room.id, room, tokens, actingAs: describe(user) };
  }

  /** What a link discloses before anyone commits to opening it. */
  async preview(token: string): Promise<InvitePreview> {
    const invite = await this.invites.findOne({ where: { token }, relations: { room: true } });
    if (!invite) return { valid: false, title: null, memberCount: 0, expiresAt: null };

    const memberCount = await this.members.countBy({ roomId: invite.roomId });

    return {
      valid: this.liveness(invite) === null,
      title: invite.room?.title ?? null,
      memberCount,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
    };
  }

  /**
   * Walks whoever holds the link into the room. A signed-in visitor keeps their
   * own name; anyone else becomes a guest at this moment and not before, so a
   * link that is never opened costs nothing.
   */
  async accept(token: string, actor: AuthUser | null): Promise<InviteSession> {
    const invite = await this.invites.findOne({ where: { token } });
    if (!invite) throw new NotFoundException('Invite not found');

    const dead = this.liveness(invite);
    if (dead) throw new GoneException(dead);

    const { user, tokens } = await this.resolveActor(actor);

    const already = await this.members.findOneBy({ roomId: invite.roomId, userId: user.id });
    if (!already) {
      // Counting the use and re-checking the limit in one statement: two people
      // opening the last seat at once would both pass a read-then-write check.
      const claimed = await this.claimSeat(invite.id);
      if (!claimed) throw new GoneException('Invite link is no longer usable');

      await this.members.save(
        this.members.create({
          roomId: invite.roomId,
          userId: user.id,
          role: MemberRole.MEMBER,
        }),
      );

      await this.roomsService.announceRoom(invite.roomId, [user.id]);
      await this.postSystemMessage(
        invite.roomId,
        user.id,
        `${user.displayName} приєднався до розмови`,
      );
    }

    const room = await this.rooms.findOneOrFail({
      where: { id: invite.roomId },
      relations: { members: { user: true } },
    });

    return { roomId: room.id, room, tokens, actingAs: describe(user) };
  }

  /** Only the room's members may read back the link that opens it. */
  async linkForRoom(roomId: string, userId: string): Promise<{ url: string } | null> {
    await this.roomsService.assertMember(roomId, userId);

    const invite = await this.invites.findOne({
      where: { roomId },
      order: { createdAt: 'DESC' },
    });
    if (!invite || this.liveness(invite)) return null;

    return { url: this.urlFor(invite.token) };
  }

  /** @returns the reason the link is dead, or null while it still works. */
  private liveness(invite: Invite): string | null {
    if (invite.revokedAt) return 'Invite link was revoked';
    if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
      return 'Invite link has expired';
    }
    if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
      return 'Invite link has been used up';
    }
    return null;
  }

  private async claimSeat(inviteId: string): Promise<boolean> {
    const result = await this.invites
      .createQueryBuilder()
      .update(Invite)
      .set({ uses: () => 'uses + 1' })
      .where('id = :inviteId', { inviteId })
      .andWhere('revoked_at IS NULL')
      .andWhere('(expires_at IS NULL OR expires_at > now())')
      .andWhere('(max_uses IS NULL OR uses < max_uses)')
      .execute();

    return (result.affected ?? 0) > 0;
  }

  /**
   * The identity to act as. Nobody signed in means a guest is minted right
   * here — and its tokens have to travel back to the browser, because that is
   * the only copy of an account with no password to sign in with again.
   */
  private async resolveActor(actor: AuthUser | null): Promise<ResolvedActor> {
    if (actor) return { user: actor, tokens: null };

    const { user, tokens } = await this.auth.createGuest();
    return { user, tokens };
  }

  private urlFor(token: string): string {
    return `${this.config.get('publicWebUrl', { infer: true })}/invite/${token}`;
  }

  /**
   * Posted as a real message so that it is in the history, in the preview and
   * on every client already watching the room — the link and the arrivals are
   * the only narration an anonymous room gets.
   */
  private async postSystemMessage(roomId: string, senderId: string, body: string): Promise<void> {
    const saved = await this.messages.save(
      this.messages.create({ roomId, senderId, body, type: MessageType.SYSTEM }),
    );

    const message = await this.messages.findOneOrFail({
      where: { id: saved.id },
      relations: { sender: true },
    });

    this.gateway.emitToRoom(roomId, WS_EVENTS.message, message);
  }
}

function describe(user: Actor) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    isGuest: user.isGuest,
  };
}
