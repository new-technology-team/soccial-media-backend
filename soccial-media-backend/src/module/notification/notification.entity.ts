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

  constructor(
    _id: ObjectId,
    userId: string,
    title: string,
    content: string,
    link: string,
    createdAt: Date,
  ) {
    this._id = _id;
    this.userId = userId;
    this.title = title;
    this.content = content;
    this.link = link;
    this.createdAt = createdAt;
  }
}
