import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Room } from './room.entity';
import { TranscriptSegment } from './transcript-segment.entity';

@Entity('call_sessions')
@Index(['roomId', 'startedAt'])
export class CallSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @Column({ name: 'livekit_room' })
  livekitRoom: string;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'recording_url', type: 'varchar', nullable: true })
  recordingUrl: string | null;

  /** LLM-generated summary produced by media-ai-service after the call. */
  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @ManyToOne(() => Room, (room) => room.calls, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @OneToMany(() => TranscriptSegment, (segment) => segment.callSession)
  segments: TranscriptSegment[];
}
