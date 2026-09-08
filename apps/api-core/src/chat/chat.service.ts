import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Message, MessageType, RoomMember } from '../database/entities';
import { RoomsService } from '../rooms/rooms.service';
import type { CallNoticeDto, CallNoticeKind, DeleteMessageDto, SendMessageDto } from './dto/chat.dto';

/** The room's own words for a call, kept where a client cannot reach them. */
const CALL_NOTICE_BODY: Record<CallNoticeKind, string> = {
  'call.started': 'Відеосесія розпочалась',
  'call.ended': 'Відеосесію завершено',
};

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(RoomMember) private readonly members: Repository<RoomMember>,
    private readonly rooms: RoomsService,
  ) {}

  async persistMessage(senderId: string, dto: SendMessageDto): Promise<Message> {
    await this.rooms.assertMember(dto.roomId, senderId);

    const saved = await this.messages.save(
      this.messages.create({
        roomId: dto.roomId,
        senderId,
        body: dto.body,
        type: dto.type ?? MessageType.TEXT,
        meta: dto.meta ?? null,
      }),
    );

    return this.messages.findOneOrFail({
      where: { id: saved.id },
      relations: { sender: true },
    });
  }

  /**
   * Writes the SYSTEM line that announces a call. The caller chooses which of
   * the two events happened and nothing else — the text comes from this file,
   * which is what keeps `SYSTEM` a thing only the server can say.
   */
  async postCallNotice(senderId: string, dto: CallNoticeDto): Promise<Message> {
    await this.rooms.assertMember(dto.roomId, senderId);

    const saved = await this.messages.save(
      this.messages.create({
        roomId: dto.roomId,
        senderId,
        body: CALL_NOTICE_BODY[dto.kind],
        type: MessageType.SYSTEM,
        meta:
          dto.kind === 'call.ended' && dto.durationMs !== undefined
            ? { kind: dto.kind, durationMs: dto.durationMs }
            : { kind: dto.kind },
      }),
    );

    return this.messages.findOneOrFail({
      where: { id: saved.id },
      relations: { sender: true },
    });
  }

  /**
   * Marks a message deleted. It is a tombstone rather than a `DELETE`: the row
   * is what the transcript, the moderation trail and any future "edited/deleted"
   * marker are read from, and history already skips `deleted_at IS NOT NULL`, so
   * from every reader's side it is gone.
   *
   * Only the author may do it. Membership is checked first so that a stranger
   * cannot learn which ids exist in a room by which error comes back.
   */
  async deleteMessage(userId: string, dto: DeleteMessageDto): Promise<void> {
    await this.rooms.assertMember(dto.roomId, userId);

    const message = await this.messages.findOne({
      where: { id: dto.messageId, roomId: dto.roomId },
    });
    if (!message || message.deletedAt) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Not your message');

    await this.messages.update(message.id, { deletedAt: new Date() });
  }

  /** Room ids the user belongs to — used to auto-join socket rooms on connect. */
  async roomIdsOf(userId: string): Promise<string[]> {
    const rows = await this.members.find({ where: { userId }, select: { roomId: true } });
    return rows.map((r) => r.roomId);
  }
}
