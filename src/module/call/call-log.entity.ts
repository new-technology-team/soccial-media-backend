import { Entity, ObjectIdColumn, ObjectId, Column } from "typeorm";

export type CallType = 'voice' | 'video';
export type CallMode = 'private' | 'group';
export type CallStatus = 'completed' | 'missed' | 'rejected' | 'no_answer' | 'cancelled' | 'failed';

@Entity()
export class CallLog {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  conversationId: string;

  @Column()
  initiatorId: number;

  @Column()
  participantIds: number[];

  @Column()
  callType: CallType;

  @Column()
  mode: CallMode;

  @Column()
  status: CallStatus;

  @Column()
  startedAt: Date;

  @Column({ nullable: true })
  answeredAt: Date | null;

  @Column({ nullable: true })
  endedAt: Date | null;

  @Column({ default: 0 })
  durationSec: number;

  @Column()
  createdAt: Date;
}
