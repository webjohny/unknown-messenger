export const SKIN_COOKIE = 'messenger.skin';

export const SKIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The stored skin, read straight from `document.cookie`.
 *
 * A cookie rather than localStorage because the choice has to be available
 * before the first render — the skin *is* the screen, so settling it a tick
 * late would paint a different app and then replace it.
 */
export function readSkinCookie(): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${SKIN_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function writeSkinCookie(id: string): void {
  document.cookie = `${SKIN_COOKIE}=${id}; path=/; max-age=${SKIN_COOKIE_MAX_AGE}; samesite=lax`;
}
