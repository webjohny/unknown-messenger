import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { configuration } from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { DatabaseModule } from './database/database.module';
import { InvitesModule } from './invites/invites.module';
import { LivekitModule } from './livekit/livekit.module';
import { RedisModule } from './redis/redis.module';
import { RoomsModule } from './rooms/rooms.module';
import { TranscriptsModule } from './transcripts/transcripts.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../../.env'],
    }),
    /**
     * A ceiling on how fast anything can be asked of the API. The tight limits
     * that matter — sign-in, invite creation — are on the routes themselves;
     * this one only exists so that an endpoint nobody thought about still
     * cannot be hit ten thousand times a minute.
     *
     * Counters live in this process. That is exact for the single API container
     * this is deployed as; behind more than one, swap in a Redis-backed
     * ThrottlerStorage or each node will allow the full limit on its own.
     */
    ThrottlerModule.forRoot({
      // The guard reads `req`/`res` off the HTTP context, which a WebSocket
      // frame does not have. Socket traffic is limited in the gateway instead.
      skipIf: (context) => context.getType() !== 'http',
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
    }),
    DatabaseModule,
    RedisModule,
    UsersModule,
    AuthModule,
    RoomsModule,
    ChatModule,
    InvitesModule,
    LivekitModule,
    TranscriptsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
