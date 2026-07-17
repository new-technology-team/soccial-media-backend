import { Entity, ObjectIdColumn, ObjectId, Column, Index } from 'typeorm';
import { Interacts } from '../../common/embedded/interacts.embed';
import { Owner } from '../../common/embedded/owner.embed';

@Entity()
@Index(['visibility', 'createdAt'])
export class Post {
  @ObjectIdColumn()
  _id: ObjectId;

  @Column()
  title: string;

  @Column()
  content: string;

  @Column()
  visibility: string;

  @Column()
  mediaUrl: string;

  @Column()
  createdAt: Date;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  @Column()
  interacts: Interacts[];

  @Column()
  owner: Owner;
}
