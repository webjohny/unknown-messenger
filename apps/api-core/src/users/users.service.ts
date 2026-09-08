import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { ChatGateway } from '../chat/chat.gateway';
import { ChatService } from '../chat/chat.service';
import { WS_EVENTS } from '../chat/dto/chat.dto';
import { User } from '../database/entities';
import { RedisService } from '../redis/redis.service';
import type { PublicUser } from './dto/users.dto';

/** Below this a query is not a search, it is a listing. */
const MIN_SEARCH_LENGTH = 2;

/**
 * `%` and `_` are wildcards to LIKE and ordinary characters to the person who
 * typed them. Escaping is not about injection — the value is bound either way —
 * but about `%` matching the entire table.
 *
 * The backslash goes first, or it would escape the escapes added after it.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

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

  /**
   * Finds people by name. Guests are excluded: an anonymous identity is
   * reachable by link, not by name.
   *
   * Two characters minimum, and the pattern characters are escaped rather than
   * passed through. Both rules exist for the same reason: without them the
   * endpoint answers "everyone" — an empty string, or a two-character `%%`,
   * would walk the whole directory and hand out the user ids that address every
   * other endpoint in the app.
   */
  search(query: string, limit = 20): Promise<User[]> {
    const term = query.trim();
    if (term.length < MIN_SEARCH_LENGTH) return Promise.resolve([]);

    const pattern = `%${escapeLikePattern(term)}%`;

    return this.users.find({
      where: [
        { username: ILike(pattern), isGuest: false },
        { displayName: ILike(pattern), isGuest: false },
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
