import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { RedisIoAdapter } from './redis/redis-io.adapter';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<AppConfig, true>);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get('corsOrigins', { infer: true }), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Redis adapter -> horizontal scaling of the Socket.io gateway.
  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connectToRedis(config.get('redis', { infer: true }));
  app.useWebSocketAdapter(redisAdapter);

  app.enableShutdownHooks();

  const port = config.get('port', { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api-core listening on http://localhost:${port}/api`);
}

void bootstrap();
