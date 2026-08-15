import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatModule } from '../chat/chat.module';
import { CallSession, TranscriptSegment } from '../database/entities';
import { RoomsModule } from '../rooms/rooms.module';
import { TranscriptsController } from './transcripts.controller';
import { TranscriptsService } from './transcripts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TranscriptSegment, CallSession]),
    ChatModule,
    RoomsModule,
  ],
  controllers: [TranscriptsController],
  providers: [TranscriptsService],
})
export class TranscriptsModule {}
