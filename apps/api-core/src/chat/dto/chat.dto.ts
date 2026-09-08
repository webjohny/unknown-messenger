import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';

import { MessageType } from '../../database/entities';

/**
 * What a client is allowed to say it is sending. SYSTEM is missing on purpose:
 * it renders as the room's own narration — the line that announces arrivals and
 * carries the invite link — so a member able to post one could put any text, and
 * any link, in the voice of the server. System messages are written by the
 * server alone (see InvitesService.postSystemMessage).
 */
const CLIENT_MESSAGE_TYPES = [
  MessageType.TEXT,
  MessageType.IMAGE,
  MessageType.FILE,
  MessageType.VIDEO_NOTE,
] as const;

/** Attachment descriptors are small; anything larger is not one. */
const META_MAX_BYTES = 4096;

function MetaWithinLimit(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'metaWithinLimit',
      validator: {
        validate: (value: unknown) => {
          try {
            return Buffer.byteLength(JSON.stringify(value) ?? '') <= META_MAX_BYTES;
          } catch {
            // Unserialisable is not storable either — jsonb would reject it.
            return false;
          }
        },
        defaultMessage: () => `meta must serialise to at most ${META_MAX_BYTES} bytes`,
      },
    },
    options,
  );
}

export class SendMessageDto {
  @IsUUID('4')
  roomId: string;

  @IsString()
  @Length(1, 8000)
  body: string;

  @IsOptional()
  @IsIn(CLIENT_MESSAGE_TYPES as readonly MessageType[], {
    message: 'type must be one of TEXT, IMAGE, FILE, VIDEO_NOTE',
  })
  type?: MessageType;

  /**
   * Free-form by design, but not unbounded: it is stored verbatim as jsonb, so
   * without a ceiling one socket frame can write a megabyte per message.
   */
  @IsOptional()
  @IsObject()
  @MetaWithinLimit()
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

export class DeleteMessageDto {
  @IsUUID('4')
  roomId: string;

  @IsUUID('4')
  messageId: string;
}

/** The call announcements a member may ask the room to post. */
export const CALL_NOTICE_KINDS = ['call.started', 'call.ended'] as const;
export type CallNoticeKind = (typeof CALL_NOTICE_KINDS)[number];

/**
 * A call notice is an event, not a message: the client reports what happened
 * and the server writes the line. That is the whole difference from letting a
 * client send `type: SYSTEM` — the wording of the room's own voice stays on
 * this side, so it cannot be turned into an invitation somewhere else.
 */
export class CallNoticeDto {
  @IsUUID('4')
  roomId: string;

  @IsIn(CALL_NOTICE_KINDS)
  kind: CallNoticeKind;

  /** How long the call lasted; only meaningful on `call.ended`. Max 24h. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400_000)
  durationMs?: number;
}

export const WS_EVENTS = {
  message: 'message:new',
  /** Carries only ids: the body is gone and must not travel a second time. */
  messageDeleted: 'message:deleted',
  typing: 'presence:typing',
  presence: 'presence:update',
  roomCreated: 'room:created',
  /** A member changed their profile — carries the whole public user. */
  userUpdated: 'user:updated',
  caption: 'call:caption',
  transcriptSaved: 'call:transcript-saved',
} as const;
