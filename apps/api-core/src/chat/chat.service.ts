import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Message, MessageType, RoomMember } from '../database/entities';
import { RoomsService } from '../rooms/rooms.service';
import type { SendMessageDto } from './dto/chat.dto';

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

  /** Room ids the user belongs to — used to auto-join socket rooms on connect. */
  async roomIdsOf(userId: string): Promise<string[]> {
    const rows = await this.members.find({ where: { userId }, select: { roomId: true } });
    return rows.map((r) => r.roomId);
  }
}
