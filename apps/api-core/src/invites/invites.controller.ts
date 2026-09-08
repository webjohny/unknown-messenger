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
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { AcceptInviteDto, CreateInviteDto } from './dto/invites.dto';
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

  /**
   * The most expensive thing an anonymous caller can ask for: each call mints a
   * user, a room, an invite and a message. Ten an hour per address is more
   * rooms than anyone opens by hand and far fewer than a script wants.
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  create(@Req() req: { user?: AuthUser }, @Body() dto: CreateInviteDto) {
    return this.invites.create(req.user ?? null, dto);
  }

  /**
   * Public on purpose: a link has to say what it is before it is opened. The
   * token is 72 random bits, so guessing one is hopeless anyway — the limit is
   * what stops someone from trying at speed and turning this into a probe.
   */
  @Get(':token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  preview(@Param('token') token: string) {
    return this.invites.preview(token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  accept(
    @Req() req: { user?: AuthUser },
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
  ) {
    return this.invites.accept(token, req.user ?? null, dto.assertion);
  }

  /** Lets a member read back the link so they can send it to someone else. */
  @Get('room/:roomId/link')
  @UseGuards(JwtAuthGuard)
  link(@CurrentUser() user: AuthUser, @Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.invites.linkForRoom(roomId, user.id);
  }

  /** Kills the link. The people already inside stay; nobody new gets in. */
  @Post('room/:roomId/revoke')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  revoke(@CurrentUser() user: AuthUser, @Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.invites.revokeForRoom(roomId, user.id);
  }
}
