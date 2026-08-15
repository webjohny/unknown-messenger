import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { RoomType } from '../../database/entities';

export class CreateRoomDto {
  @IsString()
  @Length(1, 128)
  title: string;

  @IsEnum(RoomType)
  type: RoomType;

  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  memberIds: string[];
}

export class OpenDirectDto {
  /** The peer to talk to; the caller is always the second member. */
  @IsUUID('4')
  userId: string;
}

export class ListMessagesDto {
  @IsOptional()
  @IsUUID('4')
  cursor?: string;
}
