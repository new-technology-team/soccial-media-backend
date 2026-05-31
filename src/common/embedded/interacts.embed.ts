import { Column } from 'typeorm';

export class Interacts {
  @Column()
  type: string;

  @Column()
  userId: number;

  @Column()
  username: string;

  @Column()
  displayName: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
