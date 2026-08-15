import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(3, 32)
  @Matches(/^[a-z0-9_.-]+$/i, { message: 'username may contain letters, digits, _ . - only' })
  username: string;

  @IsString()
  @Length(1, 64)
  displayName: string;

  @IsString()
  @Length(8, 128)
  password: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 128)
  password: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  username: string;
  /** Refresh tokens only: makes every issued token unique (see AuthService). */
  jti?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
