import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CallSession } from './call-session.entity';
import { User } from './user.entity';

@Entity('transcript_segments')
@Index(['callSessionId', 'startMs'])
export class TranscriptSegment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'call_session_id', type: 'uuid' })
  callSessionId: string;

  @Column({ name: 'speaker_id', type: 'uuid', nullable: true })
  speakerId: string | null;

  /** LiveKit participant identity — kept even when the speaker is not a known user. */
  @Column({ name: 'speaker_name' })
  speakerName: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ name: 'start_ms', type: 'int' })
  startMs: number;

  @Column({ name: 'end_ms', type: 'int' })
  endMs: number;

  @Column({ type: 'real', nullable: true })
  confidence: number | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  language: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => CallSession, (session) => session.segments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'call_session_id' })
  callSession: CallSession;

  @ManyToOne(() => User, (user) => user.transcriptSegments, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'speaker_id' })
  speaker: User | null;
}
