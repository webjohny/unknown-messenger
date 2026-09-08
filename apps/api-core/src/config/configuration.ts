export interface AppConfig {
  port: number;
  corsOrigins: string[];
  /** Origin the invite links point at — the address a user can actually open. */
  publicWebUrl: string;
  /**
   * Verifies the `assertion` an embedder (see `/embed/:token`) attaches to an
   * invite accept, so a fresh guest gets the visitor's real name instead of a
   * random `userNNNN`. Null until a trusted embedder is actually configured —
   * the feature is opt-in, not something every deployment needs on day one.
   */
  externalAssertionSecret: string | null;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    transcriptChannel: string;
    controlChannel: string;
    roomEventsChannel: string;
  };
  livekit: {
    apiKey: string;
    apiSecret: string;
    wsUrl: string;
    httpUrl: string;
  };
}

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

/** Anything shipped in .env.example: public knowledge, so it is not a secret. */
const PLACEHOLDER_SECRETS = new Set([
  'change_me_access_secret',
  'change_me_refresh_secret',
  'devkey',
  'devsecret_at_least_32_characters_long',
  'secret',
  'changeme',
]);

const MIN_SECRET_LENGTH = 32;

/**
 * A signing key is the whole of the authentication: whoever holds it mints a
 * token for any user id there is. The example values are in the repository, so
 * booting with one is the same as having no authentication at all — and that
 * has to stop the process, not warn into a log nobody reads.
 *
 * Length is checked too: a short key is brute-forceable offline against any
 * token the holder already has, and JWT libraries accept it without complaint.
 */
const requiredSecret = (key: string): string => {
  const value = required(key);

  if (PLACEHOLDER_SECRETS.has(value.toLowerCase())) {
    throw new Error(
      `${key} is still set to the placeholder from .env.example. Generate a real one: openssl rand -base64 48`,
    );
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${key} must be at least ${MIN_SECRET_LENGTH} characters (got ${value.length}). Generate one: openssl rand -base64 48`,
    );
  }

  return value;
};

/**
 * Same quality bar as `requiredSecret`, but the variable itself is allowed to
 * be absent — unlike the JWT/LiveKit secrets, nothing breaks by not having
 * one, it just means no embedder is trusted yet.
 */
const optionalSecret = (key: string): string | null => {
  const value = process.env[key];
  if (!value) return null;
  return requiredSecret(key);
};

export const configuration = (): AppConfig => {
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');

  const accessSecret = requiredSecret('JWT_ACCESS_SECRET');
  const refreshSecret = requiredSecret('JWT_REFRESH_SECRET');
  // Sharing one key collapses the two token types into each other: a 15-minute
  // access token would verify as a refresh token and buy a 30-day session.
  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different keys');
  }

  return {
    port: Number(process.env.PORT ?? 4000),
    corsOrigins,
    // The web app is the thing a link has to open, and in every deployment so
    // far it is the first allowed origin — so that is the default.
    publicWebUrl: (process.env.PUBLIC_WEB_URL ?? corsOrigins[0]).replace(/\/+$/, ''),
    externalAssertionSecret: optionalSecret('EXTERNAL_ASSERTION_SECRET'),
    jwt: {
      accessSecret,
      refreshSecret,
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    },
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      transcriptChannel: process.env.REDIS_TRANSCRIPT_CHANNEL ?? 'transcripts:final',
      controlChannel: process.env.REDIS_CONTROL_CHANNEL ?? 'media:control',
      roomEventsChannel: process.env.REDIS_ROOM_EVENTS_CHANNEL ?? 'rooms:events',
    },
    livekit: {
      apiKey: required('LIVEKIT_API_KEY'),
      // Signs the join tokens the SFU trusts; same stakes as a JWT secret.
      apiSecret: requiredSecret('LIVEKIT_API_SECRET'),
      wsUrl: process.env.LIVEKIT_URL ?? 'ws://localhost:7880',
      httpUrl: process.env.LIVEKIT_HTTP_URL ?? 'http://localhost:7880',
    },
  };
};
