import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

export interface WsRateLimit {
  /** How many frames of this event are allowed inside the window. */
  limit: number;
  windowMs: number;
}

export const WS_THROTTLE = 'ws:throttle';

/** Declares the budget for one gateway handler; read by WsThrottleGuard. */
export const WsThrottle = (limit: WsRateLimit) => SetMetadata(WS_THROTTLE, limit);

interface Bucket {
  count: number;
  /** When the current window opened, in epoch ms. */
  startedAt: number;
}

/**
 * A fixed window per socket per event.
 *
 * The counters hang off `socket.data`, so they are freed the moment the
 * connection closes — a server-wide map keyed by socket id would be a slow leak
 * with nobody left to sweep it. Per socket rather than per user: a client that
 * wants a second budget has to open a second connection, and every connection
 * pays for its own handshake.
 *
 * @returns false when the caller has spent its budget for this window.
 */
export function consumeWsBudget(client: Socket, event: string, config: WsRateLimit): boolean {
  const buckets: Record<string, Bucket> = (client.data.rateBuckets ??= {});
  const now = Date.now();
  const bucket = buckets[event];

  if (!bucket || now - bucket.startedAt >= config.windowMs) {
    buckets[event] = { count: 1, startedAt: now };
    return true;
  }

  bucket.count += 1;
  return bucket.count <= config.limit;
}

/**
 * Enforces `@WsThrottle` on handlers the client is waiting on an answer from:
 * going over is an error the sender has to see, because the message it just
 * sent optimistically has to come back off the screen.
 *
 * Fire-and-forget floods — presence, typing — are not guarded here. Answering
 * a keystroke with an exception is worse than the noise itself, so those call
 * `consumeWsBudget` directly and simply stop.
 */
@Injectable()
export class WsThrottleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const config = this.reflector.get<WsRateLimit | undefined>(WS_THROTTLE, context.getHandler());
    if (!config) return true;

    const client = context.switchToWs().getClient<Socket>();
    if (!consumeWsBudget(client, context.getHandler().name, config)) {
      throw new WsException('Too many requests');
    }
    return true;
  }
}
