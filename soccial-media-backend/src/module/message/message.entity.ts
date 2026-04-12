import { Entity, ObjectIdColumn, ObjectId, Column } from 'typeorm';

@Entity()
export class Message {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  conversationId: string;

  @Column()
  content: string;

  @Column()
  createdAt: Date;

  @Column({ nullable: true })
  fileUrl: string;

  @Column()
  isRecalled: boolean;

  constructor(
    _id: ObjectId,
    conversationId: string,
    content: string,
    createdAt: Date,
    fileUrl: string,
    isRecalled: boolean,
  ) {
    this._id = _id;
    this.conversationId = conversationId;
    this.content = content;
    this.createdAt = createdAt;
    this.fileUrl = fileUrl;
    this.isRecalled = isRecalled;
  }
}
