export interface AppConfig {
  port: number;
  corsOrigins: string[];
  /** Origin the invite links point at — the address a user can actually open. */
  publicWebUrl: string;
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

export const configuration = (): AppConfig => {
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');

  return {
    port: Number(process.env.PORT ?? 4000),
    corsOrigins,
    // The web app is the thing a link has to open, and in every deployment so
    // far it is the first allowed origin — so that is the default.
    publicWebUrl: (process.env.PUBLIC_WEB_URL ?? corsOrigins[0]).replace(/\/+$/, ''),
    jwt: {
      accessSecret: required('JWT_ACCESS_SECRET'),
      refreshSecret: required('JWT_REFRESH_SECRET'),
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
      apiSecret: required('LIVEKIT_API_SECRET'),
      wsUrl: process.env.LIVEKIT_URL ?? 'ws://localhost:7880',
      httpUrl: process.env.LIVEKIT_HTTP_URL ?? 'http://localhost:7880',
    },
  };
};
