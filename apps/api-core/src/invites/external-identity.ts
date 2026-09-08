import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Lets a trusted embedder (e.g. cashflow-nestjs) tell an anonymous invite
 * accept who the visitor really is, without either side sharing a login
 * system. Only the holder of `EXTERNAL_ASSERTION_SECRET` can produce a token
 * that verifies — a raw `?displayName=` query param would let anyone claim
 * to be anyone.
 *
 * Deliberately not a JWT: this is a single first-party use (one payload
 * shape, one secret, a few seconds of TTL), and hand-rolled HMAC keeps it
 * consistent with the rest of this module's `node:crypto` tokens
 * (see `InvitesService`'s invite token) instead of pulling in JWT semantics
 * for a one-field payload.
 */

interface AssertionPayload {
  displayName: string;
  /** Unix ms. Short-lived — minted fresh right before the embed loads. */
  exp: number;
}

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64url');

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signExternalIdentity(
  displayName: string,
  secret: string,
  ttlMs = 60_000,
): string {
  const payload = b64url(JSON.stringify({ displayName, exp: Date.now() + ttlMs }));
  return `${payload}.${sign(payload, secret)}`;
}

/** @returns the asserted identity, or null if the assertion is missing, tampered with, or expired. */
export function verifyExternalIdentity(
  assertion: string | undefined,
  secret: string,
): { displayName: string } | null {
  if (!assertion) return null;

  const dot = assertion.indexOf('.');
  if (dot < 0) return null;

  const payload = assertion.slice(0, dot);
  const signature = assertion.slice(dot + 1);

  const expected = sign(payload, secret);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

  let parsed: AssertionPayload;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AssertionPayload;
  } catch {
    return null;
  }

  if (typeof parsed.displayName !== 'string' || !parsed.displayName.trim()) return null;
  if (typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) return null;

  return { displayName: parsed.displayName };
}
