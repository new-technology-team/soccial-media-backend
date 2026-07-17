import { Entity, ObjectIdColumn, ObjectId, Column, Index } from 'typeorm';
import { Owner } from '../../common/embedded/owner.embed';

export class CommentReact {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  type: string;
  createdAt: Date;
}

@Entity()
@Index(['postId'])
@Index(['parentId'])
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
