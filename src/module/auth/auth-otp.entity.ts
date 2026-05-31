import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'auth_otp' })
export class AuthOtp {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 190 })
    identifier!: string;

    @Column({ type: 'varchar', length: 20 })
    purpose!: string;

    @Column({ type: 'varchar', length: 10 })
    code!: string;

    @Column({ type: 'datetime' })
    expiresAt!: Date;

    @Column({ type: 'datetime', nullable: true })
    usedAt!: Date | null;

    @Column({ type: 'datetime' })
    createdAt!: Date;
}
