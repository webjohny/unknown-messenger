import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

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
})
export class AppModule {}
