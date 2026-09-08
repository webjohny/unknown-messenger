import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { randomInt, randomUUID } from 'node:crypto';
import { IsNull, LessThan, MoreThan, Not, QueryFailedError, Repository } from 'typeorm';

import { RefreshToken, User } from '../database/entities';
import { RedisService } from '../redis/redis.service';
import type { AppConfig } from '../config/configuration';
import type { AuthTokens, JwtPayload, LoginDto, RegisterDto } from './dto/auth.dto';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const PG_UNIQUE_VIOLATION = '23505';

/** How many times a guest name collision is retried before giving up. */
const GUEST_NAME_ATTEMPTS = 8;

/**
 * Published when every session of a user is killed, so the gateway can hang up
 * the sockets those sessions are holding — on whichever node they landed.
 */
export interface SessionRevokedEvent {
  type: 'session.revoked';
  userId: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly tokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly redis: RedisService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const exists = await this.users.exists({
      where: [{ email: dto.email }, { username: dto.username }],
    });
    if (exists) throw new ConflictException('Email or username already taken');

    const user = await this.users.save(
      this.users.create({
        email: dto.email,
        username: dto.username,
        displayName: dto.displayName,
        passwordHash: await argon2.hash(dto.password),
      }),
    );

    return this.issueTokens({ sub: user.id, username: user.username });
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    // passwordHash has `select: false`, so it must be requested explicitly.
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: dto.email })
      .getOne();

    // A guest row has no hash at all: there is no password that opens it, and
    // argon2.verify would throw rather than return false on the null.
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens({ sub: user.id, username: user.username });
  }

  /**
   * Mints a throwaway identity for someone who arrived through an invite link.
   * There is no email, no password and no way back in: the caller keeps the
   * tokens or loses the account, which is exactly what "anonymous" means here.
   *
   * `displayName` — already verified by the caller (see `verifyExternalIdentity`)
   * — is what the room sees instead of the random `userNNNN`. The `username`
   * login handle is still randomly allocated: it is an internal uniqueness key,
   * not shown anywhere a display name isn't more appropriate.
   */
  async createGuest(displayName?: string): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await this.saveGuestWithFreeName(displayName);
    return { user, tokens: await this.issueTokens({ sub: user.id, username: user.username }) };
  }

  /**
   * Names are picked at random rather than counted up, so two guests landing in
   * the same millisecond can collide. The unique index — not a read-then-write
   * check — is what settles it; this just tries again with a new number.
   *
   * The four-digit space is small and fills up, so each retry widens it: early
   * guests get the short `user3737` the design asks for, and the pool still
   * cannot run out once thousands of them exist.
   */
  private async saveGuestWithFreeName(displayName?: string): Promise<User> {
    for (let attempt = 0; attempt < GUEST_NAME_ATTEMPTS; attempt += 1) {
      const ceiling = 10_000 * 10 ** Math.floor(attempt / 2);
      const username = `user${randomInt(ceiling / 10, ceiling)}`;
      try {
        return await this.users.save(
          this.users.create({
            email: null,
            passwordHash: null,
            username,
            displayName: displayName ?? username,
            isGuest: true,
          }),
        );
      } catch (err) {
        const isTaken =
          err instanceof QueryFailedError &&
          (err as { code?: string }).code === PG_UNIQUE_VIOLATION;
        if (!isTaken) throw err;
      }
    }
    throw new InternalServerErrorException('Could not allocate a guest name');
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('jwt.refreshSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.jti) throw new UnauthorizedException('Invalid refresh token');

    // One indexed row, then one hash comparison — the cost of this endpoint has
    // to be flat, or holding many live sessions becomes a way to make the
    // server do arbitrary work for a single unauthenticated request.
    const stored = await this.tokens.findOne({
      where: {
        jti: payload.jti,
        userId: payload.sub,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!stored || !(await argon2.verify(stored.tokenHash, refreshToken))) {
      // The signature is valid but the token is not active: it was already
      // rotated or revoked, which means a leaked copy is in play. Kill the
      // whole family rather than just refusing this one request.
      await this.logout(payload.sub);
      throw new UnauthorizedException('Refresh token revoked');
    }

    // Rotation: the presented token dies with the request that used it.
    await this.tokens.update({ id: stored.id }, { revokedAt: new Date() });

    const tokens = await this.issueTokens({ sub: payload.sub, username: payload.username });

    // The row just rotated is dead weight from here on, and so is everything
    // this user has left behind. Swept on the way out rather than by a cron
    // nobody has set up: the table only grows where sessions are being used.
    await this.pruneUserTokens(payload.sub);

    return tokens;
  }

  /**
   * Ends every session this user has. The open sockets have to be told: each
   * one was authenticated at connect time and would otherwise keep receiving
   * messages until its access token ran out — which is precisely the window a
   * "log out everywhere" is meant to close.
   */
  async logout(userId: string): Promise<void> {
    await this.tokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });

    const event: SessionRevokedEvent = { type: 'session.revoked', userId };
    await this.redis.publish(
      this.config.get('redis.roomEventsChannel', { infer: true }),
      event,
    );
  }

  /** Drops rotated/expired rows; call from a cron if the table grows. */
  async pruneExpiredTokens(): Promise<void> {
    await this.tokens.delete({ expiresAt: LessThan(new Date()) });
  }

  /**
   * The same sweep, narrowed to one user so it can run inline on a refresh.
   * Revoked rows go too: rotation retires one on every refresh, and a session
   * left running for a month would otherwise leave a row behind each time.
   */
  private async pruneUserTokens(userId: string): Promise<void> {
    await this.tokens.delete([
      { userId, expiresAt: LessThan(new Date()) },
      { userId, revokedAt: Not(IsNull()) },
    ]);
  }

  /** Used by the WS gateway to authenticate a socket handshake. */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get('jwt.accessSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async issueTokens(payload: JwtPayload): Promise<AuthTokens> {
    const jwtConfig = this.config.get('jwt', { infer: true });
    // `iat` has one-second resolution, so two refreshes inside the same second
    // would otherwise produce byte-identical tokens — and rotation would be a
    // no-op, since the "new" token is the one just revoked. It doubles as the
    // handle the stored row is found by; see RefreshToken.jti.
    const jti = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: jwtConfig.accessSecret,
        expiresIn: jwtConfig.accessTtl,
      }),
      this.jwt.signAsync(
        { ...payload, jti },
        { secret: jwtConfig.refreshSecret, expiresIn: jwtConfig.refreshTtl },
      ),
    ]);

    await this.tokens.save(
      this.tokens.create({
        userId: payload.sub,
        jti,
        tokenHash: await argon2.hash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      }),
    );

    return { accessToken, refreshToken };
  }
}
