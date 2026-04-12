import { Entity, ObjectIdColumn, ObjectId, Column } from 'typeorm';
import { Member } from '../../common/embedded/member.embed';
import { ConversationStatus } from '../../common/enum/conversation-status.enum';

@Entity()
export class Conversation {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  conversationName: string;

  @Column()
  status: ConversationStatus;

  @Column()
  createdAt: Date;

  @Column(() => Member)
  members: Member[];

  constructor(
    _id: ObjectId,
    conversationName: string,
    status: ConversationStatus,
    createdAt: Date,
    members: Member[],
  ) {
    this._id = _id;
    this.conversationName = conversationName;
    this.status = status;
    this.createdAt = createdAt;
    this.members = members;
  }
}
