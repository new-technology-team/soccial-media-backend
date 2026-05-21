import { Entity, ObjectIdColumn, ObjectId, Column } from 'typeorm';

@Entity()
export class Notification {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  userId: string;

  @Column()
  title: string;

  @Column()
  content: string;

  @Column()
  link: string;

  @Column()
  createdAt: Date;

  @Column({ default: false })
  isRead: boolean;
}
