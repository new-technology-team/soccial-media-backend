import { Column } from 'typeorm';

export class Member {
  @Column()
  userId: number;

  @Column()
  username: string;

  @Column()
  displayName: string;

  @Column({ nullable: true })
  avatar?: string;
}
