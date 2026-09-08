import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis, { type RedisOptions } from 'ioredis';
import type { IncomingMessage } from 'node:http';
import type { ServerOptions, Server } from 'socket.io';

type AllowRequestCallback = (err: string | null | undefined, success: boolean) => void;

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private clients: Redis[] = [];

  /**
   * @param corsOrigins the same allow-list the HTTP side uses. The socket layer
   *   used to reflect whatever Origin it was handed, which made every page on
   *   the internet an allowed caller; only the fact that tokens live in
   *   localStorage rather than cookies kept that from being a session ride.
   */
  constructor(
    private readonly app: INestApplicationContext,
    private readonly corsOrigins: string[],
  ) {
    super(app);
  }

  async connectToRedis(options: RedisOptions): Promise<void> {
    const pubClient = new Redis(options);
    const subClient = pubClient.duplicate();
    this.clients = [pubClient, subClient];
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigins, credentials: true },
      allowRequest: (req: IncomingMessage, callback: AllowRequestCallback) =>
        callback(null, this.isOriginAllowed(req.headers.origin)),
    });
    server.adapter(this.adapterConstructor);
    return server;
  }

  /**
   * The `cors` option above only governs the polling transport; a WebSocket
   * upgrade is not a CORS request at all, and browsers let any page open one
   * to any host. So the allow-list has to be applied to the handshake itself,
   * or it stops nothing that the client's `transports: ['websocket']` does.
   *
   * A request with no Origin is allowed through: that is a non-browser caller —
   * a script, a test, the Go bot — and the header is the browser's own
   * statement about which page it is acting for. Nothing is trusted on the
   * strength of it either way; the handshake still has to carry a valid token.
   */
  private isOriginAllowed(origin: string | undefined): boolean {
    return origin === undefined || this.corsOrigins.includes(origin);
  }

  async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.allSettled(this.clients.map((c) => c.quit()));
  }
}
