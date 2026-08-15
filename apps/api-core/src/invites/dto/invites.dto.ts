import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

import type { AuthTokens } from '../../auth/dto/auth.dto';
import type { Room } from '../../database/entities';

export class CreateInviteDto {
  /** Shown as the room's title; the caller rarely bothers, hence the default. */
  @IsOptional()
  @IsString()
  @Length(1, 128)
  title?: string;

  /** Null/omitted means the link keeps working until it is revoked. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxUses?: number;

  /** Lifetime of the link. Omitted means it does not expire on its own. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 365)
  expiresInHours?: number;
}

/**
 * `tokens` is non-null only when this very call minted a guest. A signed-in
 * caller keeps the session they already had, so handing them a second one
 * would silently replace their identity with an anonymous one.
 */
export interface InviteSession {
  roomId: string;
  room: Room;
  tokens: AuthTokens | null;
  /** The identity the caller is acting as inside the room. */
  actingAs: { id: string; username: string; displayName: string; isGuest: boolean };
}

export interface CreatedInvite extends InviteSession {
  token: string;
  url: string;
}

/** What a stranger may learn about a link before deciding to open it. */
export interface InvitePreview {
  valid: boolean;
  title: string | null;
  memberCount: number;
  expiresAt: string | null;
}
