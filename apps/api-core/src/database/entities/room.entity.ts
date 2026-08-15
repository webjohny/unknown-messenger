import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { CallSession } from './call-session.entity';
import { Message } from './message.entity';
import { RoomMember } from './room-member.entity';

export enum RoomType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
  STREAM = 'STREAM',
  /**
   * Reachable only through the invite link that created it. An ANON room is
   * deliberately kept out of every member's chat list — losing the link is how
   * an anonymous conversation ends.
   */
  ANON = 'ANON',
}

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Slug used verbatim as the LiveKit room name. */
  @Index({ unique: true })
  @Column()
  name: string;

  @Column()
  title: string;

  @Column({ type: 'enum', enum: RoomType, default: RoomType.GROUP })
  type: RoomType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => RoomMember, (member) => member.room)
  members: RoomMember[];

  @OneToMany(() => Message, (message) => message.room)
  messages: Message[];

  @OneToMany(() => CallSession, (session) => session.room)
  calls: CallSession[];
}
