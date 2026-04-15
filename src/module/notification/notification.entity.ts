import { Entity, ObjectIdColumn, ObjectId, Column } from "typeorm";

@Entity()
export class Notification {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  userId: number;

  @Column()
  type: string;

  @Column()
  title: string;

  @Column()
  body: string;

  @Column({ nullable: true })
  meta: any;

  @Column({ default: false })
  isRead: boolean;

  @Column()
  createdAt: Date;
}