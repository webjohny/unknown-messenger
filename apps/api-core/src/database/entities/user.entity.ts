import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Message } from './message.entity';
import { RefreshToken } from './refresh-token.entity';
import { RoomMember } from './room-member.entity';
import { TranscriptSegment } from './transcript-segment.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Null for guests, who are created by opening an invite link and never hand
   * over an address. Postgres allows any number of NULLs under a unique index,
   * so the constraint still holds for everyone who does register.
   *
   * Not selected by default: rooms are serialised with their members attached,
   * and a stranger who joined on an invite link has no business reading the
   * address of the registered user on the other side. Sign-in matches it in a
   * WHERE clause, which does not need the column to be selectable.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', select: false, nullable: true })
  email: string | null;

  @Index({ unique: true })
  @Column()
  username: string;

  @Column({ name: 'display_name' })
  displayName: string;

  /**
   * Never selected by default — must be explicitly requested via addSelect.
   * Null for guests: there is no password to check because there is no way to
   * sign in as one. A guest only ever holds the token it was handed.
   */
  @Column({ name: 'password_hash', type: 'varchar', select: false, nullable: true })
  passwordHash: string | null;

  /**
   * Created by an invite link rather than by registration. Guests are real rows
   * so that messages, membership and calls need no special case, but they are
   * invisible to search and own nothing outside the room they were made for.
   */
  @Column({ name: 'is_guest', type: 'boolean', default: false })
  isGuest: boolean;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => RoomMember, (member) => member.user)
  memberships: RoomMember[];

  @OneToMany(() => Message, (message) => message.sender)
  messages: Message[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];

  @OneToMany(() => TranscriptSegment, (segment) => segment.speaker)
  transcriptSegments: TranscriptSegment[];
}
