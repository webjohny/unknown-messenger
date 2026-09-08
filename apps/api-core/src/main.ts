import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { RedisIoAdapter } from './redis/redis-io.adapter';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<AppConfig, true>);

  /**
   * Exactly one proxy sits in front of this process (Traefik), so the client
   * address is the last entry X-Forwarded-For — without this every request
   * would be attributed to the proxy, and the rate limiter would count the
   * whole internet as a single caller.
   *
   * The count is deliberate rather than `true`: the container publishes no
   * ports, so the only way in is through that one hop, and trusting further
   * would let a caller forge the header and hand themselves a fresh quota.
   */
  app.set('trust proxy', 1);

  const corsOrigins = config.get('corsOrigins', { infer: true });

  /**
   * This process serves JSON, never a document — so the headers that matter are
   * the ones that stop a browser from treating a response as something it is
   * not, and `contentSecurityPolicy` is turned off because there is no page
   * here to constrain (the web container sets its own; see nginx.conf).
   *
   * `crossOriginResourcePolicy` is relaxed to same-site rather than left at
   * helmet's same-origin: the API and the web app are different origins of the
   * same site, and the strict value would block the app's own fetches.
   */
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: { maxAge: 31_536_000, includeSubDomains: true },
    }),
  );

  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Redis adapter -> horizontal scaling of the Socket.io gateway.
  const redisAdapter = new RedisIoAdapter(app, corsOrigins);
  await redisAdapter.connectToRedis(config.get('redis', { infer: true }));
  app.useWebSocketAdapter(redisAdapter);

  app.enableShutdownHooks();

  const port = config.get('port', { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api-core listening on http://localhost:${port}/api`);
}

void bootstrap();
