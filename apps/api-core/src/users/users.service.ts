import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { ChatGateway } from '../chat/chat.gateway';
import { ChatService } from '../chat/chat.service';
import { WS_EVENTS } from '../chat/dto/chat.dto';
import { User } from '../database/entities';
import { RedisService } from '../redis/redis.service';
import type { PublicUser } from './dto/users.dto';

/** The columns anyone in a shared room is allowed to see. */
const PUBLIC_COLUMNS = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  isGuest: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly redis: RedisService,
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  /**
   * Renames whoever is asking. This exists for the guests an invite link mints
   * as `user3737`: the name is the only thing they own, so changing it is the
   * one profile edit that has to work without an account.
   *
   * The new name is a bound parameter, never interpolated — the validated
   * whitelist in UpdateDisplayNameDto is about what other members will read,
   * not about what reaches the database.
   */
  async rename(userId: string, displayName: string): Promise<PublicUser> {
    await this.users.update({ id: userId }, { displayName });

    const user = await this.users.findOneOrFail({
      where: { id: userId },
      select: { ...PUBLIC_COLUMNS },
    });

    // Everyone already looking at a thread this user has spoken in is showing
    // the old name against every one of their messages; only they can repaint it.
    const roomIds = await this.chat.roomIdsOf(userId);
    for (const roomId of roomIds) {
      this.gateway.emitToRoom(roomId, WS_EVENTS.userUpdated, user);
    }

    return user;
  }

  /** Guests are excluded: an anonymous identity is reachable by link, not by name. */
  search(query: string, limit = 20): Promise<User[]> {
    return this.users.find({
      where: [
        { username: ILike(`%${query}%`), isGuest: false },
        { displayName: ILike(`%${query}%`), isGuest: false },
      ],
      select: { id: true, username: true, displayName: true, avatarUrl: true },
      take: limit,
    });
  }

  async withPresence(userIds: string[]): Promise<Record<string, boolean>> {
    const entries = await Promise.all(
      userIds.map(async (id) => [id, await this.redis.isOnline(id)] as const),
    );
    return Object.fromEntries(entries);
  }
}
