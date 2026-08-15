import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { UpdateDisplayNameDto, type PublicUser } from './dto/users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('search')
  search(@Query('q') q = '') {
    return this.users.search(q);
  }

  /** Renames the caller and nobody else: the id comes from the token. */
  @Patch('me')
  rename(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDisplayNameDto,
  ): Promise<PublicUser> {
    return this.users.rename(user.id, dto.displayName);
  }
}
