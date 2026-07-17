import { Entity, ObjectIdColumn, ObjectId, Column, Index } from 'typeorm';

@Entity()
@Index(['userId', 'createdAt'])
@Index(['userId', 'isRead'])
export class Notification {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  userId: string;

  @Column()
  title: string;

  @Column()
  content: string;

  @Column({ nullable: true })
  type?: string;

  @Column({ nullable: true })
  meta?: Record<string, any> | null;

  @Column()
  link: string;

  @Column()
  createdAt: Date;

  @Column({ default: false })
  isRead: boolean;
}
