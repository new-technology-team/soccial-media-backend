import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_block')
@Index(['blockerUserId', 'blockedUserId'], { unique: true })
export class UserBlock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  blockerUserId: number;

  @Column()
  blockedUserId: number;

  @Column()
  createdAt: Date;
}
