import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { RedisService } from '../redis/redis.service';
import type { AppConfig } from '../config/configuration';
import { JoinRoomDto, type JoinRoomResponse } from './dto/livekit.dto';
import { LivekitService } from './livekit.service';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class LivekitController {
  constructor(
    private readonly livekit: LivekitService,
    private readonly redis: RedisService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Post('join')
  async join(@CurrentUser() user: AuthUser, @Body() dto: JoinRoomDto): Promise<JoinRoomResponse> {
    const result = await this.livekit.createJoinToken(user, dto);

    if (dto.enableTranscription) {
      // Fire-and-forget: the Go service attaches its bot asynchronously so the
      // caller is never blocked on STT availability.
      await this.redis.publish(this.config.get('redis.controlChannel', { infer: true }), {
        action: 'start_transcription',
        roomName: result.roomName,
        callSessionId: result.callSessionId,
        botToken: await this.livekit.createBotToken(result.roomName, 'silent-bot'),
      });
    }

    return result;
  }

  @Get(':name/participants')
  participants(@Param('name') name: string) {
    return this.livekit.listParticipants(name);
  }

  @Delete(':name/participants/:identity')
  async kick(@Param('name') name: string, @Param('identity') identity: string): Promise<void> {
    await this.livekit.removeParticipant(name, identity);
  }

  @Post(':name/end')
  async end(@Param('name') name: string): Promise<{ ok: true }> {
    await this.livekit.endCallSession(name);
    await this.redis.publish(this.config.get('redis.controlChannel', { infer: true }), {
      action: 'stop_transcription',
      roomName: name,
    });
    return { ok: true };
  }
}
