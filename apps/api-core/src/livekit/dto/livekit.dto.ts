import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class JoinRoomDto {
  @IsUUID('4')
  roomId: string;

  /** Stream viewers get a subscribe-only grant. */
  @IsOptional()
  @IsBoolean()
  viewerOnly?: boolean;

  /** Ask media-ai-service to attach its STT bot to this room. */
  @IsOptional()
  @IsBoolean()
  enableTranscription?: boolean;
}

export interface JoinRoomResponse {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  callSessionId: string;
}
