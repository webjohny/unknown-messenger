import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Room } from './room.entity';
import { User } from './user.entity';

/**
 * The whole address of an anonymous room. Whoever holds the token is a member
 * on arrival, so the token — not a membership list — is the access control, and
 * it is the only thing that stands between a stranger and the conversation.
 */
@Entity('invites')
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The slug that appears in the URL; short enough to send in a chat message. */
  @Index({ unique: true })
  @Column()
  token: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  /** The guest or the registered user who pressed "create link". */
  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  /** Null means the link keeps working; otherwise it dies after this many joins. */
  @Column({ name: 'max_uses', type: 'int', nullable: true })
  maxUses: number | null;

  @Column({ type: 'int', default: 0 })
  uses: number;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Room, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;
}
