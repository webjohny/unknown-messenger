import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto, RefreshDto, RegisterDto, type AuthTokens } from './dto/auth.dto';
import type { AuthUser } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Five accounts an hour from one address; a real person needs one. */
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  register(@Body() dto: RegisterDto): Promise<AuthTokens> {
    return this.auth.register(dto);
  }

  /**
   * The one endpoint where guessing pays, so it is the tightest: ten tries per
   * five minutes, then a fifteen-minute lockout of the address. A password
   * spray gets a handful of attempts an hour instead of thousands a second.
   */
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 300_000, blockDuration: 900_000 } })
  login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return this.auth.login(dto);
  }

  /**
   * Loose by comparison: a legitimate session refreshes about four times an
   * hour, but every tab does it on its own and a reconnect storm can bunch
   * them together. The limit is here for the argon2 cost of a bogus token, not
   * for the honest traffic.
   */
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 300_000 } })
  refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: AuthUser): Promise<void> {
    return this.auth.logout(user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
