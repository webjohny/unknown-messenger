import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { User } from '../database/entities';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly redis: RedisService,
  ) {}

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
