import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import {
  DataSource,
  FindOperator,
  IsNull,
  LessThan,
  Not,
  QueryFailedError,
  Repository,
} from 'typeorm';

import { ConfigService } from '@nestjs/config';

import {
  MemberRole,
  Message,
  MessageType,
  Room,
  RoomMember,
  RoomType,
  User,
} from '../database/entities';
import { RedisService } from '../redis/redis.service';
import type { AppConfig } from '../config/configuration';

const PG_UNIQUE_VIOLATION = '23505';

/** Published on the room-events channel whenever a user gains access to a room. */
export interface RoomCreatedEvent {
  type: 'room.created';
  roomId: string;
  memberIds: string[];
}

export interface CreateRoomInput {
  title: string;
  type: RoomType;
  memberIds: string[];
}

/** The newest message of a room, enough to preview it in a list. */
export interface RoomPreview {
  id: string;
  body: string;
  type: MessageType;
  createdAt: Date;
  senderId: string;
  senderName: string;
}

export type RoomWithPreview = Room & { lastMessage: RoomPreview | null };

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(RoomMember) private readonly members: Repository<RoomMember>,
    @InjectRepository(Message) private readonly messagesRepo: Repository<Message>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Tells every node's gateway that these users must be subscribed to the room.
   * Sockets connected before the room existed would otherwise miss its messages
   * until the next reconnect.
   */
  announceRoom(roomId: string, memberIds: string[]): Promise<void> {
    const event: RoomCreatedEvent = { type: 'room.created', roomId, memberIds };
    return this.redis.publish(this.config.get('redis.roomEventsChannel', { infer: true }), event);
  }

  /**
   * The chat list. ANON rooms are left out on purpose: an anonymous room is
   * addressed by its invite link and by nothing else, so surfacing it here
   * would undo the one property that makes it anonymous.
   */
  listForUser(userId: string): Promise<RoomWithPreview[]> {
    return this.listMemberRooms(userId, Not(RoomType.ANON));
  }

  /**
   * The rooms `listForUser` hides. A guest owns nothing else, so this is what
   * lets the app put them back where they belong after a reload.
   */
  listAnonForUser(userId: string): Promise<RoomWithPreview[]> {
    return this.listMemberRooms(userId, RoomType.ANON);
  }

  private async listMemberRooms(
    userId: string,
    type: FindOperator<RoomType> | RoomType,
  ): Promise<RoomWithPreview[]> {
    const memberships = await this.members.find({
      where: { userId },
      select: { roomId: true },
    });
    const roomIds = memberships.map((m) => m.roomId);
    if (roomIds.length === 0) return [];

    const rooms = await this.rooms.find({
      where: roomIds.map((id) => ({ id, type })),
      relations: { members: { user: true } },
      order: { createdAt: 'DESC' },
    });
    if (rooms.length === 0) return [];

    const previews = await this.lastMessages(rooms.map((room) => room.id));

    return rooms.map((room) =>
      Object.assign(room, { lastMessage: previews.get(room.id) ?? null }),
    );
  }

  /**
   * The newest surviving message of each room, in one round trip. `DISTINCT ON`
   * keeps the first row per room after the sort, which is why the ordering has
   * to start with the room — a per-room query would be N+1 on the chat list.
   */
  private async lastMessages(roomIds: string[]): Promise<Map<string, RoomPreview>> {
    const rows = await this.messagesRepo
      .createQueryBuilder('m')
      .distinctOn(['m.room_id'])
      .innerJoin('m.sender', 'sender')
      .select([
        'm.id AS id',
        'm.room_id AS "roomId"',
        'm.body AS body',
        'm.type AS type',
        'm.created_at AS "createdAt"',
        'm.sender_id AS "senderId"',
        'sender.display_name AS "senderName"',
      ])
      .where('m.room_id IN (:...roomIds)', { roomIds })
      .andWhere('m.deleted_at IS NULL')
      .orderBy('m.room_id')
      .addOrderBy('m.created_at', 'DESC')
      .getRawMany<RoomPreview & { roomId: string }>();

    return new Map(rows.map(({ roomId, ...preview }) => [roomId, preview]));
  }

  async create(ownerId: string, input: CreateRoomInput): Promise<Room> {
    // ANON rooms exist only as the far end of an invite link; letting one be
    // created here would produce a link-only room with no link.
    if (input.type === RoomType.ANON) {
      throw new BadRequestException('Anonymous rooms are created through an invite link');
    }

    const memberIds = Array.from(new Set([ownerId, ...input.memberIds]));

    const room = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(Room, {
          name: `room_${randomUUID()}`,
          title: input.title,
          type: input.type,
        }),
      );

      await manager.save(
        memberIds.map((userId) =>
          manager.create(RoomMember, {
            roomId: created.id,
            userId,
            role: userId === ownerId ? MemberRole.OWNER : MemberRole.MEMBER,
          }),
        ),
      );

      return manager.findOneOrFail(Room, {
        where: { id: created.id },
        relations: { members: { user: true } },
      });
    });

    await this.announceRoom(room.id, memberIds);
    return room;
  }

  /**
   * Opens the 1:1 conversation between two users, creating it on first contact.
   * The room name is derived from the sorted pair of ids, so the unique index on
   * `rooms.name` — not a read-then-write check — is what prevents duplicates when
   * both sides tap "message" at the same moment.
   */
  async openDirect(userId: string, peerId: string): Promise<Room> {
    if (userId === peerId) throw new BadRequestException('Cannot open a chat with yourself');

    const peer = await this.users.findOne({ where: { id: peerId } });
    if (!peer) throw new NotFoundException('User not found');

    const name = `direct_${[userId, peerId].sort().join('_')}`;

    const existing = await this.loadDirect(name);
    if (existing) return existing;

    try {
      const created = await this.dataSource.transaction(async (manager) => {
        const me = await manager.findOneByOrFail(User, { id: userId });

        const room = await manager.save(
          manager.create(Room, {
            name,
            title: `${me.displayName} · ${peer.displayName}`,
            type: RoomType.DIRECT,
          }),
        );

        await manager.save([
          manager.create(RoomMember, { roomId: room.id, userId, role: MemberRole.OWNER }),
          manager.create(RoomMember, { roomId: room.id, userId: peerId, role: MemberRole.OWNER }),
        ]);

        return manager.findOneOrFail(Room, {
          where: { id: room.id },
          relations: { members: { user: true } },
        });
      });

      await this.announceRoom(created.id, [userId, peerId]);
      return created;
    } catch (err) {
      if (err instanceof QueryFailedError && (err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        const raced = await this.loadDirect(name);
        if (raced) return raced;
      }
      throw err;
    }
  }

  private loadDirect(name: string): Promise<Room | null> {
    return this.rooms.findOne({ where: { name }, relations: { members: { user: true } } });
  }

  /** Throws unless the user is a member; returns the room and membership otherwise. */
  async assertMember(roomId: string, userId: string): Promise<{ room: Room; membership: RoomMember }> {
    const room = await this.rooms.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');

    const membership = await this.members.findOne({ where: { roomId, userId } });
    if (!membership) throw new ForbiddenException('Not a member of this room');

    return { room, membership };
  }

  findByLivekitName(name: string): Promise<Room | null> {
    return this.rooms.findOne({ where: { name } });
  }

  memberIdsOf(roomId: string): Promise<RoomMember[]> {
    return this.members.find({ where: { roomId }, select: { userId: true } });
  }

  /**
   * Keyset pagination: `cursor` is the oldest message already rendered by the
   * client, so the query walks backwards from it and the page is reversed to
   * chronological order before being returned.
   */
  async messages(roomId: string, userId: string, cursor?: string, take = 50): Promise<Message[]> {
    await this.assertMember(roomId, userId);

    let before: Date | undefined;
    if (cursor) {
      const anchor = await this.messagesRepo.findOne({
        where: { id: cursor },
        select: { createdAt: true },
      });
      before = anchor?.createdAt;
    }

    const rows = await this.messagesRepo.find({
      where: {
        roomId,
        deletedAt: IsNull(),
        ...(before ? { createdAt: LessThan(before) } : {}),
      },
      relations: { sender: true },
      order: { createdAt: 'DESC' },
      take,
    });

    return rows.reverse();
  }
}
