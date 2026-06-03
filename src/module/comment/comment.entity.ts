import { Entity, ObjectIdColumn, ObjectId, Column } from 'typeorm';
import { Owner } from '../../common/embedded/owner.embed';

export class CommentReact {
  userId: number;
  displayName: string;
  avatarUrl: string;
  type: string;
  createdAt: Date;
}

@Entity()
export class Comment {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  postId: string;

  @Column()
  content: string;

  @Column({ nullable: true })
  parentId: string;

  @Column()
  fileUrl: string;

  @Column()
  createdAt: Date;

  @Column()
  owner: Owner;

  @Column(() => CommentReact)
  reacts: CommentReact[];
}
