import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { MessageType } from '../../database/entities';

export class SendMessageDto {
  @IsUUID('4')
  roomId: string;

  @IsString()
  @Length(1, 8000)
  body: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;

  /** Client-generated id, echoed back so the optimistic message can be reconciled. */
  @IsOptional()
  @IsString()
  @Length(1, 64)
  clientId?: string;
}

export class TypingDto {
  @IsUUID('4')
  roomId: string;

  @IsBoolean()
  isTyping: boolean;
}

export class RoomScopeDto {
  @IsUUID('4')
  roomId: string;
}

export const WS_EVENTS = {
  message: 'message:new',
  typing: 'presence:typing',
  presence: 'presence:update',
  roomCreated: 'room:created',
  /** A member changed their profile — carries the whole public user. */
  userUpdated: 'user:updated',
  caption: 'call:caption',
  transcriptSaved: 'call:transcript-saved',
} as const;
