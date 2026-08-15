import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { AppConfig } from '../config/configuration';

type Handler = (payload: unknown) => void | Promise<void>;

/**
 * Two connections are kept on purpose: a Redis client in subscriber mode cannot
 * issue regular commands, so publishing/presence writes need their own socket.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;
  readonly subscriber: Redis;
  private readonly handlers = new Map<string, Set<Handler>>();

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const options = this.config.get('redis', { infer: true });
    this.client = new Redis(options);
    this.subscriber = new Redis(options);

    this.subscriber.on('message', (channel: string, raw: string) => {
      const handlers = this.handlers.get(channel);
      if (!handlers?.size) return;

      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        this.logger.warn(`Dropping non-JSON payload on channel "${channel}"`);
        return;
      }

      for (const handler of handlers) {
        void Promise.resolve(handler(payload)).catch((err) =>
          this.logger.error(`Handler for "${channel}" failed: ${String(err)}`),
        );
      }
    });
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    await this.client.publish(channel, JSON.stringify(payload));
  }

  async subscribe(channel: string, handler: Handler): Promise<void> {
    const existing = this.handlers.get(channel);
    if (existing) {
      existing.add(handler);
      return;
    }
    this.handlers.set(channel, new Set([handler]));
    await this.subscriber.subscribe(channel);
    this.logger.log(`Subscribed to "${channel}"`);
  }

  // ---- presence -------------------------------------------------------

  private presenceKey(userId: string): string {
    return `presence:user:${userId}`;
  }

  async markOnline(userId: string, socketId: string): Promise<number> {
    const key = this.presenceKey(userId);
    await this.client.sadd(key, socketId);
    await this.client.expire(key, 60 * 60 * 12);
    return this.client.scard(key);
  }

  /** @returns number of sockets still connected for that user. */
  async markOffline(userId: string, socketId: string): Promise<number> {
    const key = this.presenceKey(userId);
    await this.client.srem(key, socketId);
    return this.client.scard(key);
  }

  async isOnline(userId: string): Promise<boolean> {
    return (await this.client.scard(this.presenceKey(userId))) > 0;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.client.quit(), this.subscriber.quit()]);
  }
}
