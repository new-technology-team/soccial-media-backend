import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Report {
  @PrimaryGeneratedColumn()
  reportId: number;

  @Column({ default: 'PENDING' })
  status: string;

  @Column()
  createAt: Date;

  @Column()
  description: string;

  @Column()
  targetId: string;

  @Column()
  targetType: string;

  @Column()
  reportType: string;

  @Column()
  userId: number;
}
