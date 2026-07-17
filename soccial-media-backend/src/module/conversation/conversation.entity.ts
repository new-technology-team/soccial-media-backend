import { Entity, ObjectIdColumn, ObjectId, Column } from 'typeorm';
import { Member } from '../../common/embedded/member.embed';

@Entity()
export class Conversation {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  conversationName: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: 'active' })
  status: string;

  @Column()
  createdAt: Date;

  @Column({ default: () => 'new Date()' })
  lastMessageAt: Date;

  @Column({ nullable: true })
  lastMessage: any;

  @Column({ default: 0 })
  unreadCount: number;

  @Column()
  members: Member[];

  @Column({ type: 'simple-array', nullable: true })
  memberIds: string[];
}
