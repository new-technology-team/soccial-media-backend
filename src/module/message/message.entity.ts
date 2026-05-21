import { Entity, ObjectIdColumn, ObjectId, Column } from 'typeorm';

@Entity()
export class Message {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  conversationId: string;

  @Column()
  senderId: number;

  @Column({ nullable: true })
  senderName: string;

  @Column({ nullable: true })
  senderFullName: string;

  @Column({ nullable: true })
  senderAvatar: string;

  @Column()
  content: string;

  @Column({ default: 'text' })
  type: string;

  @Column({ nullable: true })
  mediaUrl: string;

  @Column({ default: false })
  isRecalled: boolean;

  @Column()
  createdAt: Date;
}
