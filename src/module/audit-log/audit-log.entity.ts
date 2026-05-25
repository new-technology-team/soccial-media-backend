import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn()
  auditLogId: number;

  @Column({ type: 'int', nullable: true })
  actorId: number | null;

  @Column({ type: 'varchar', length: 32 })
  actorRole: string;

  @Column({ type: 'varchar', length: 120 })
  action: string;

  @Column({ type: 'varchar', length: 80 })
  targetType: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  targetId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'datetime' })
  createdAt: Date;
}
