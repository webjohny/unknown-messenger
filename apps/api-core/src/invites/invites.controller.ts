import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { CreateInviteDto } from './dto/invites.dto';
import { InvitesService } from './invites.service';

/**
 * The only endpoints in the app that a caller with no account may reach. Both
 * of the write paths run under OptionalJwtAuthGuard: the same request has to
 * work for a signed-in user, who keeps their name, and for a stranger, who is
 * given a guest one.
 */
@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  create(@Req() req: { user?: AuthUser }, @Body() dto: CreateInviteDto) {
    return this.invites.create(req.user ?? null, dto);
  }

  /** Public on purpose: a link has to say what it is before it is opened. */
  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invites.preview(token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  @UseGuards(OptionalJwtAuthGuard)
  accept(@Req() req: { user?: AuthUser }, @Param('token') token: string) {
    return this.invites.accept(token, req.user ?? null);
  }

  /** Lets a member read back the link so they can send it to someone else. */
  @Get('room/:roomId/link')
  @UseGuards(JwtAuthGuard)
  link(@CurrentUser() user: AuthUser, @Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.invites.linkForRoom(roomId, user.id);
  }
}
