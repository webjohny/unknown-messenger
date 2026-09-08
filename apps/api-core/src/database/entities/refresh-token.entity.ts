import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from './user.entity';

@Entity('refresh_tokens')
@Index(['userId', 'revokedAt'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /**
   * The `jti` carried by the token this row stands for — the handle that finds
   * it in one indexed lookup.
   *
   * Without it the only way to identify a presented token is to argon2-verify
   * it against every active row of that user, which turns one request into as
   * many password hashes as the caller has bothered to accumulate. The id is
   * not a secret and proves nothing on its own: `token_hash` is still what
   * decides, and it is still verified.
   *
   * Nullable for rows written before this column existed; they can no longer
   * be matched, so their holders refresh once and sign in again.
   */
  @Index({ unique: true })
  @Column({ name: 'jti', type: 'uuid', nullable: true })
  jti: string | null;

  @Column({ name: 'token_hash' })
  tokenHash: string;

  @Column({ name: 'user_agent', type: 'varchar', nullable: true })
  userAgent: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
