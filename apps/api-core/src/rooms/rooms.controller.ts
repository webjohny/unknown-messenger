import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { CreateRoomDto, ListMessagesDto, OpenDirectDto } from './dto/rooms.dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.rooms.listForUser(user.id);
  }

  /** The link-only rooms `list` deliberately hides; see RoomsService. */
  @Get('anon')
  listAnon(@CurrentUser() user: AuthUser) {
    return this.rooms.listAnonForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoomDto) {
    return this.rooms.create(user.id, dto);
  }

  /** Idempotent: returns the existing 1:1 chat when one is already open. */
  @Post('direct')
  @HttpCode(200)
  openDirect(@CurrentUser() user: AuthUser, @Body() dto: OpenDirectDto) {
    return this.rooms.openDirect(user.id, dto.userId);
  }

  @Get(':id/messages')
  messages(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) roomId: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.rooms.messages(roomId, user.id, query.cursor);
  }
}
