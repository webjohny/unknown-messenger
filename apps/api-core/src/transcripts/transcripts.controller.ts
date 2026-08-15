import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { TranscriptsService } from './transcripts.service';

@Controller('transcripts')
@UseGuards(JwtAuthGuard)
export class TranscriptsController {
  constructor(private readonly transcripts: TranscriptsService) {}

  @Get('room/:roomId')
  byRoom(@CurrentUser() user: AuthUser, @Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.transcripts.listByRoom(roomId, user.id);
  }

  @Get('session/:callSessionId')
  bySession(@Param('callSessionId', ParseUUIDPipe) callSessionId: string) {
    return this.transcripts.listByCallSession(callSessionId);
  }
}
