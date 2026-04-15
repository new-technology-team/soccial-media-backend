import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class AuthOtp {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  identifier: string;

  @Column()
  purpose: string;

  @Column()
  code: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'datetime' })
  createdAt: Date;
}
