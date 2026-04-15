import { Column } from 'typeorm';

export class Owner {
  @Column()
  userId: number;

  @Column()
  username: string;

  @Column()
  displayName: string;

  @Column({ nullable: true })
  avatar?: string;
}
