import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { CallSession, TranscriptSegment } from '../database/entities';
import { ChatGateway } from '../chat/chat.gateway';
import { WS_EVENTS } from '../chat/dto/chat.dto';
import { RedisService } from '../redis/redis.service';
import { RoomsService } from '../rooms/rooms.service';
import type { AppConfig } from '../config/configuration';

/** Payload published by media-ai-service on `transcripts:final`. */
interface TranscriptPayload {
  roomName: string;
  callSessionId?: string;
  segments: {
    speakerIdentity: string;
    speakerName: string;
    text: string;
    startMs: number;
    endMs: number;
    confidence?: number;
    language?: string;
  }[];
  summary?: string;
  final: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TranscriptsService implements OnModuleInit {
  private readonly logger = new Logger(TranscriptsService.name);

  constructor(
    @InjectRepository(TranscriptSegment) private readonly segments: Repository<TranscriptSegment>,
    @InjectRepository(CallSession) private readonly sessions: Repository<CallSession>,
    private readonly redis: RedisService,
    private readonly rooms: RoomsService,
    private readonly gateway: ChatGateway,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    const channel = this.config.get('redis.transcriptChannel', { infer: true });
    await this.redis.subscribe(channel, (payload) => this.handle(payload as TranscriptPayload));
  }

  private async handle(payload: TranscriptPayload): Promise<void> {
    const room = await this.rooms.findByLivekitName(payload.roomName);
    if (!room) {
      this.logger.warn(`Transcript for unknown LiveKit room "${payload.roomName}"`);
      return;
    }

    const session = payload.callSessionId
      ? await this.sessions.findOne({ where: { id: payload.callSessionId } })
      : await this.sessions.findOne({
          where: { roomId: room.id, endedAt: IsNull() },
          order: { startedAt: 'DESC' },
        });

    if (!session) {
      this.logger.warn(`No active call session for room "${payload.roomName}"`);
      return;
    }

    if (payload.segments.length > 0) {
      await this.segments.insert(
        payload.segments.map((s) => ({
          callSessionId: session.id,
          // The bot uses the app user id as LiveKit identity for real users.
          speakerId: UUID_RE.test(s.speakerIdentity) ? s.speakerIdentity : null,
          speakerName: s.speakerName,
          text: s.text,
          startMs: s.startMs,
          endMs: s.endMs,
          confidence: s.confidence ?? null,
          language: s.language ?? null,
        })),
      );
    }

    if (payload.summary) {
      await this.sessions.update({ id: session.id }, { summary: payload.summary });
    }

    if (payload.final) {
      this.gateway.emitToRoom(room.id, WS_EVENTS.transcriptSaved, {
        roomId: room.id,
        callSessionId: session.id,
        segmentCount: payload.segments.length,
        summary: payload.summary ?? null,
      });
    }
  }

  listByCallSession(callSessionId: string): Promise<TranscriptSegment[]> {
    return this.segments.find({
      where: { callSessionId },
      order: { startMs: 'ASC' },
    });
  }

  async listByRoom(roomId: string, userId: string): Promise<CallSession[]> {
    await this.rooms.assertMember(roomId, userId);
    return this.sessions.find({
      where: { roomId },
      relations: { segments: true },
      // Newest call first, but each transcript reads in spoken order.
      order: { startedAt: 'DESC', segments: { startMs: 'ASC' } },
      take: 20,
    });
  }
}
