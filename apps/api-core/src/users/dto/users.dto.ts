import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

/**
 * A name is letters, digits and a handful of marks people actually type — the
 * whitelist is what keeps control characters, zero-width joiners and bidi
 * overrides out of a string that every other member will see rendered.
 *
 * All three apostrophes are in: Ukrainian keyboards produce ʼ (U+02BC) and
 * autocorrect turns it into ’ (U+2019), so «Мар'яна» must not depend on which
 * one the browser sent.
 */
const DISPLAY_NAME = /^[\p{L}\p{N}][\p{L}\p{N} _.'ʼ’-]*$/u;

export class UpdateDisplayNameDto {
  // Runs before validation: a name padded with spaces is the same name, and a
  // run of them in the middle is a way to draw a blank-looking nickname.
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : value,
  )
  @IsString()
  @Length(2, 32)
  @Matches(DISPLAY_NAME, {
    message: 'displayName may contain letters, digits, spaces and _ . - only',
  })
  displayName: string;
}

/** What a rename hands back — and broadcasts to everyone in the room. */
export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
}
